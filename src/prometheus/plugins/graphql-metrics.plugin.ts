import {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from '@apollo/server';
import { PrometheusService } from '../../server-manager/prometheus.service';
import { Injectable } from '@nestjs/common';

/**
 * Apollo Server plugin to collect GraphQL metrics
 */
@Injectable()
export class GraphQLMetricsPlugin implements ApolloServerPlugin {
  constructor(private readonly prometheusService: PrometheusService) {}

  async requestDidStart(): Promise<GraphQLRequestListener<any>> {
    const startTime = Date.now();
    let operationName = 'unknown';
    let operationType = 'unknown';

    return {
      async didResolveOperation(requestContext) {
        operationName = requestContext.operationName || 'anonymous';
        operationType = requestContext.operation?.operation || 'unknown';
      },

      async willSendResponse(requestContext) {
        const duration = (Date.now() - startTime) / 1000;
        const hasErrors = requestContext.errors && requestContext.errors.length > 0;

        // Record API request
        this.prometheusService.apiRequestsTotal.inc({
          method: 'GRAPHQL',
          route: operationName,
          status_code: hasErrors ? '400' : '200',
        });

        // Record request duration
        this.prometheusService.apiRequestDuration.observe(
          {
            method: 'GRAPHQL',
            route: operationName,
          },
          duration,
        );

        // Record errors if any
        if (hasErrors) {
          requestContext.errors?.forEach((error) => {
            this.prometheusService.apiErrorsTotal.inc({
              method: 'GRAPHQL',
              route: operationName,
              error_type: error.extensions?.code?.toString() || 'GRAPHQL_ERROR',
            });
          });
        }
      },

      async executionDidStart() {
        return {
          willResolveField({ info }) {
            const start = Date.now();
            return () => {
              const duration = (Date.now() - start) / 1000;
              
              // Only track resolver duration if it takes more than 10ms
              if (duration > 0.01) {
                this.prometheusService.apiRequestDuration.observe(
                  {
                    method: 'GRAPHQL_RESOLVER',
                    route: `${info.parentType.name}.${info.fieldName}`,
                  },
                  duration,
                );
              }
            };
          },
        };
      },
    };
  }
}
