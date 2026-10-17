export interface HealthStatus {
  status: 'ok';
}

export const getHealthStatus = (): HealthStatus => {
  return {
    status: 'ok',
  };
};
