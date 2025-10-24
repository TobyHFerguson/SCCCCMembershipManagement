// jest.config.js

module.exports = {
  // Use ts-jest to handle TypeScript files
  preset: 'ts-jest',
  testEnvironment: 'node',
  // This is the key part: point to your setup file
  setupFilesAfterEnv: ['./jest.setup.ts'],
  // Make sure Jest can find your source files
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  // This is the updated transform section
  transform: {
    '^.+\\.jsx?$': 'babel-jest', // Transpile .js and .jsx files with babel
    '^.+\\.tsx?$': 'ts-jest', // Transpile .ts and .tsx files with ts-jest
  },
  // This is a default value so you can remove it
  // But if you wanted to be explicit, here it is:
  testMatch: ['**/?(*.)+(spec|test).[tj]s?(x)'],
};