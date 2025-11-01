import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConvertJwtExpirationToText1761999940000 implements MigrationInterface {
  name = 'ConvertJwtExpirationToText1761999940000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Convert JwtAccessTokenExpiration from number (minutes) to text (e.g., "15m", "3h")
    // Default conversion: if valueNumber exists, convert it to text format
    await queryRunner.query(`
      DO $$
      DECLARE
        access_token_value INTEGER;
        refresh_token_value INTEGER;
      BEGIN
        -- Get and convert JwtAccessTokenExpiration
        SELECT "valueNumber" INTO access_token_value
        FROM server_settings
        WHERE "configType" = 'JwtAccessTokenExpiration';
        
        IF access_token_value IS NOT NULL THEN
          -- Convert minutes to text format
          UPDATE server_settings
          SET 
            "valueText" = CASE
              WHEN access_token_value >= 1440 THEN (access_token_value / 1440)::TEXT || 'd'  -- >= 1 day -> Xd
              WHEN access_token_value >= 60 THEN (access_token_value / 60)::TEXT || 'h'      -- >= 1 hour -> Xh
              ELSE access_token_value::TEXT || 'm'                                             -- minutes -> Xm
            END,
            "valueNumber" = NULL
          WHERE "configType" = 'JwtAccessTokenExpiration';
        END IF;
        
        -- Get and convert JwtRefreshTokenExpiration
        SELECT "valueNumber" INTO refresh_token_value
        FROM server_settings
        WHERE "configType" = 'JwtRefreshTokenExpiration';
        
        IF refresh_token_value IS NOT NULL THEN
          -- Convert days to text format
          UPDATE server_settings
          SET 
            "valueText" = refresh_token_value::TEXT || 'd',
            "valueNumber" = NULL
          WHERE "configType" = 'JwtRefreshTokenExpiration';
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Convert back from text to number (this is a best-effort conversion)
    await queryRunner.query(`
      DO $$
      DECLARE
        access_token_text TEXT;
        refresh_token_text TEXT;
        access_token_num INTEGER;
        refresh_token_num INTEGER;
      BEGIN
        -- Get and convert JwtAccessTokenExpiration back to minutes
        SELECT "valueText" INTO access_token_text
        FROM server_settings
        WHERE "configType" = 'JwtAccessTokenExpiration';
        
        IF access_token_text IS NOT NULL THEN
          -- Parse text format back to minutes
          SELECT CASE
            WHEN access_token_text ~ 'd$' THEN CAST(LEFT(access_token_text, -1) AS INTEGER) * 1440  -- Xd -> minutes
            WHEN access_token_text ~ 'h$' THEN CAST(LEFT(access_token_text, -1) AS INTEGER) * 60    -- Xh -> minutes
            WHEN access_token_text ~ 'm$' THEN CAST(LEFT(access_token_text, -1) AS INTEGER)         -- Xm -> minutes
            ELSE NULL
          END INTO access_token_num;
          
          IF access_token_num IS NOT NULL THEN
            UPDATE server_settings
            SET 
              "valueNumber" = access_token_num,
              "valueText" = NULL
            WHERE "configType" = 'JwtAccessTokenExpiration';
          END IF;
        END IF;
        
        -- Get and convert JwtRefreshTokenExpiration back to days
        SELECT "valueText" INTO refresh_token_text
        FROM server_settings
        WHERE "configType" = 'JwtRefreshTokenExpiration';
        
        IF refresh_token_text IS NOT NULL THEN
          -- Parse text format back to days
          SELECT CASE
            WHEN refresh_token_text ~ 'd$' THEN CAST(LEFT(refresh_token_text, -1) AS INTEGER)  -- Xd -> days
            WHEN refresh_token_text ~ 'h$' THEN CAST(LEFT(refresh_token_text, -1) AS INTEGER) / 24  -- Xh -> days
            ELSE NULL
          END INTO refresh_token_num;
          
          IF refresh_token_num IS NOT NULL THEN
            UPDATE server_settings
            SET 
              "valueNumber" = refresh_token_num,
              "valueText" = NULL
            WHERE "configType" = 'JwtRefreshTokenExpiration';
          END IF;
        END IF;
      END $$;
    `);
  }
}

