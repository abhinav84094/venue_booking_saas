export const fail = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });
export const must = (condition, message, statusCode = 400) => {
  if (!condition) throw fail(message, statusCode);
};
