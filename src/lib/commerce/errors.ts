export function userError(message: string): Error {
  const error = new Error(message) as Error & { commerce: true };
  error.commerce = true;
  return error;
}

export function isCommerceError(error: unknown): error is Error {
  return error instanceof Error && Boolean((error as Error & { commerce?: boolean }).commerce);
}
