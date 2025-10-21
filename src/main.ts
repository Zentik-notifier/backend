import {
  BadRequestException,
  INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { createAdminUsers } from './seeds/admin-users.seed';
import { ServerSettingsService } from './server-manager/server-settings.service';
import { DatabaseLoggerService } from './server-manager/database-logger.service';
import { ServerSettingType } from './entities/server-setting.entity';
import dataSource from '../ormconfig';
import { ensureAdminBucket } from './seeds/admin-bucket.seed';
import { ensurePublicBucket } from './seeds/public-bucket.seed';

// Global reference to the application instance
let appInstance: INestApplication | null = null;

async function generateTypes(app: INestApplication) {
  const logger = new Logger('TypesGenerator');
  logger.log('🔄 Generating TypeScript types from OpenAPI...');

  const config = new DocumentBuilder()
    .setTitle('Zentik API')
    .setDescription('The Zentik notification API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  const fs = require('fs');
  const path = require('path');

  // Save OpenAPI spec
  const openApiPath = path.join(__dirname, '..', 'openapi.json');
  fs.writeFileSync(openApiPath, JSON.stringify(document, null, 2));
  logger.log(`✅ OpenAPI spec saved to ${openApiPath}`);

  await app.close();
}

async function runMigrations() {
  const logger = new Logger('Migrations');
  
  if (process.env.DB_SYNCHRONIZE === 'true') {
    logger.log('⚠️  DB_SYNCHRONIZE is enabled, skipping migrations');
    return;
  }

  try {
    logger.log('🔄 Initializing database connection for migrations...');
    await dataSource.initialize();
    
    logger.log('🔄 Running pending migrations...');
    const migrations = await dataSource.runMigrations();
    
    if (migrations.length > 0) {
      logger.log(`✅ Executed ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        logger.log(`  - ${migration.name}`);
      });
    } else {
      logger.log('✅ Database is up to date, no migrations to run');
    }
    
    await dataSource.destroy();
    logger.log('✅ Migration process completed\n');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    throw error;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Log very first step before any initialization
  logger.log('🏁 Zentik Backend initialization started');
  logger.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.log(`🗄️  Database type: ${process.env.DB_TYPE || 'postgres'}`);
  logger.log(`🔌 Database host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}`);
  logger.log(`📦 Database name: ${process.env.DB_NAME || 'zentik'}`);
  logger.log(`🔧 Synchronize: ${process.env.DB_SYNCHRONIZE === 'true' ? 'enabled' : 'disabled'}`);
  
  // Run migrations before creating the app
  await runMigrations();
  
  logger.log('⏳ Creating NestJS application...');

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Buffer logs until custom logger is set
  });

  logger.log('✅ NestJS application created successfully');

  app.setGlobalPrefix('/api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
      exceptionFactory: (errors) => {
        const result = errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        }));
        return new BadRequestException({
          message: 'Validation failed',
          errors: result,
        });
      },
    }),
  );

  // Check if we're generating types
  if (process.argv.includes('--generate-types')) {
    await generateTypes(app);
    process.exit(0);
  }

  // Get CORS configuration from ServerSettings
  const serverSettingsService = app.get(ServerSettingsService);

  const corsOrigin = (await serverSettingsService.getSettingByType(ServerSettingType.CorsOrigin))?.valueText
    ?? '*';
  const corsCredentialsSetting = await serverSettingsService.getSettingByType(ServerSettingType.CorsCredentials);
  const corsCredentials = corsCredentialsSetting?.valueBool ?? true;

  app.enableCors({
    origin: corsOrigin,
    credentials: corsCredentials,
  });

  // Setup Swagger documentation
  const config = new DocumentBuilder()
    .setTitle('Zentik API')
    .setDescription('The Zentik notification API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // Serve a small helper script to enable quick login from Swagger UI
  const swaggerHelperPath = '/api/docs/swagger-custom.js';
  app.use(swaggerHelperPath, (req: Request, res: Response) => {
    res.type('application/javascript').send(`
      window.addEventListener('load', function() {
        // Inject a small login form into Swagger UI topbar
        function injectLogin(ui) {
          var topbar = document.querySelector('.swagger-ui .topbar');
          if (!topbar || document.getElementById('swagger-quick-login')) return;
          var container = document.createElement('div');
          container.id = 'swagger-quick-login';
          container.style.display = 'flex';
          container.style.gap = '8px';
          container.style.alignItems = 'center';
          container.style.marginLeft = '16px';
          container.innerHTML = '<input id="swu" type="text" placeholder="username/email" style="padding:4px" />' +
                                 '<input id="swp" type="password" placeholder="password" style="padding:4px" />' +
                                 '<button id="swlogin" style="padding:4px 8px">Login</button>' +
                                 '<span id="swstatus" style="margin-left:8px;color:#999"></span>';
          topbar.appendChild(container);

          function setStatus(s, ok){
            var statusEl = document.getElementById('swstatus');
            if(statusEl){ statusEl.textContent = s; statusEl.style.color = ok? '#3c763d':'#a94442'; }
          }

          // Restore token from localStorage if present
          try {
            var saved = localStorage.getItem('swagger_token');
            if (saved) {
              try { ui.preauthorizeApiKey && ui.preauthorizeApiKey('bearer', saved); } catch(e){}
              try { ui.preauthorizeApiKey && ui.preauthorizeApiKey('JWT or Access Token', saved); } catch(e){}
              setStatus('Authorized (restored)', true);
            }
          } catch(_) {}

          var btn = document.getElementById('swlogin');
          btn && btn.addEventListener('click', async function() {
            var uEl = document.getElementById('swu');
            var pEl = document.getElementById('swp');
            var u = (uEl && uEl.value) || '';
            var p = (pEl && pEl.value) || '';
            if (!u || !p) { setStatus('Missing credentials', false); return; }
            try {
              const base = window.location.origin;
              const prefix = '/api/v1';
              const res = await fetch(base + prefix + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(/@/.test(u) ? { email: u, password: p } : { username: u, password: p })
              });
              if (!res.ok) { setStatus('Login failed: ' + res.status, false); return; }
              const json = await res.json();
              var token = json && (json.accessToken || (json.data && json.data.accessToken));
              if (!token) { setStatus('No token returned', false); return; }
              try { localStorage.setItem('swagger_token', token); } catch(_) {}
              // Try to preauthorize using common security names
              try { ui.preauthorizeApiKey && ui.preauthorizeApiKey('bearer', token); } catch(e){}
              try { ui.preauthorizeApiKey && ui.preauthorizeApiKey('JWT or Access Token', token); } catch(e){}
              setStatus('Authorized', true);
            } catch (e) {
              setStatus('Error: ' + (e && e.message || e), false);
            }
          });
        }
        // SwaggerUI exposes window.ui
        var check = setInterval(function(){ if (window.ui) { try { injectLogin(window.ui); } catch(_){} clearInterval(check); } }, 200);
      });
    `);
  });

  SwaggerModule.setup('api/docs', app, document, {
    customJs: swaggerHelperPath,
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  app.use('/api/openapi.json', (req: Request, res: Response) => {
    res.json(document);
  });

  // Save OpenAPI spec to file for type generation
  const fs = require('fs');
  const path = require('path');
  fs.writeFileSync(
    path.join(__dirname, '..', 'openapi.json'),
    JSON.stringify(document, null, 2),
  );

  // Check if frontend is available
  const publicPath = path.join(__dirname, '..', 'public');
  if (fs.existsSync(publicPath)) {
    logger.log('✅ Frontend web app detected - serving from /public');
  } else {
    logger.log('⚠️  No public directory found - running in API-only mode');
  }

  logger.log('🚀 Zentik Backend starting...');

  // Always create admin users at startup
  try {
    const dataSource = app.get(DataSource);
    await createAdminUsers(dataSource);
    logger.log('✅ Admin users initialization completed.');
  } catch (err) {
    logger.error('❌ Error during admin users initialization:', err);
  }

  // Initialize admin bucket at startup (after admin users)
  try {
    const dataSource = app.get(DataSource);
    await ensureAdminBucket(dataSource);
    logger.log('✅ Admin bucket initialization completed.');
  } catch (err) {
    logger.error('❌ Error during admin bucket initialization:', err);
  }

  // Initialize public bucket at startup (after admin bucket)
  try {
    const dataSource = app.get(DataSource);
    await ensurePublicBucket(dataSource);
    logger.log('✅ Public bucket initialization completed.');
  } catch (err) {
    logger.error('❌ Error during public bucket initialization:', err);
  }

  // Set up custom database logger to intercept all logs
  try {
    const databaseLogger = await app.resolve(DatabaseLoggerService);
    app.useLogger(databaseLogger);
    logger.log('✅ Database logger configured');
  } catch (err) {
    logger.error('❌ Error setting up database logger:', err);
  }

  // Initialize server settings from environment variables (includes defaults)
  try {
    const serverSettingsService = app.get(ServerSettingsService);
    await serverSettingsService.initializeFromEnv();
    logger.log('✅ Server settings initialization completed.');
  } catch (err) {
    logger.error('❌ Error during server settings initialization:', err);
  }

  const port = process.env.BACKEND_PORT ?? 3000;
  await app.listen(port);

  // Store the app instance globally for restart functionality
  appInstance = app;

  logger.log(`🎯 Server running on http://localhost:${port}`);
}

/**
 * Restart the application by closing and reinitializing
 */
export async function restartApplication(): Promise<void> {
  const logger = new Logger('AppRestart');

  if (!appInstance) {
    throw new Error('Application instance not available');
  }

  logger.warn('🔄 Restarting application...');

  try {
    // Close the current application instance
    await appInstance.close();
    logger.log('✅ Application closed successfully');

    // Wait a moment to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 500));

    // Bootstrap a new instance
    await bootstrap();
    logger.log('✅ Application restarted successfully');
  } catch (error) {
    logger.error('❌ Failed to restart application:', error);
    throw error;
  }
}

bootstrap().catch((error) => {
  console.error('💥 Failed to start application:', error);
  process.exit(1);
});
