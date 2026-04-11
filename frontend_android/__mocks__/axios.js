const mockInstance = {
  get: jest.fn(),
  post: jest.fn(),
  patch: jest.fn(),
  delete: jest.fn(),
  interceptors: { request: { use: jest.fn() } },
};

module.exports = {
  create: jest.fn(() => mockInstance),
  __mockInstance: mockInstance,
};
