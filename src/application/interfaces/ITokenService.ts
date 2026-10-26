export interface TokenPayload {
  userId: number;
  roleId: number;
  authVersion: number;
  mustChangePassword: boolean;
}

export interface ITokenService {
  generateToken(payload: TokenPayload): string;

  verifyToken(token: string): TokenPayload;
}
