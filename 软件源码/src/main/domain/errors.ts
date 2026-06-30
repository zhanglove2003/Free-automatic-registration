export class ComplianceBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComplianceBoundaryError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}
