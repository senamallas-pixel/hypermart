module.exports = {
  getItemAsync: jest.fn(() => Promise.resolve('mock-token')),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
};
