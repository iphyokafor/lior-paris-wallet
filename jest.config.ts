module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
    '^.+\\.ts?$': 'ts-jest',
    '^.+\\.js?$': 'babel-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: 'coverage',
  collectCoverage: true,
  coverageProvider: 'v8',
  testMatch: ['**/test/**/**/*.unit.spec.ts', '**/test/**/**/*.int.spec.ts'],
  coveragePathIgnorePatterns: ['node_modules', '<rootDir>/src/common'],
};
