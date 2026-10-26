
import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";

import {
  ITokenService,
  TokenPayload,
} from "../../application/interfaces/ITokenService";

export class JwtTokenService implements ITokenService {
  private readonly secret: string;
  private readonly expiresIn: SignOptions["expiresIn"];

  constructor() {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret || jwtSecret.length < 64) {
      throw new Error(
        "JWT_SECRET is missing or too short"
      );
    }

    this.secret = jwtSecret;

    this.expiresIn =
      (process.env.JWT_EXPIRES_IN || "1h") as SignOptions["expiresIn"];
  }

  
  generateToken(payload: TokenPayload): string {
    return jwt.sign(
      {
        userId: payload.userId,
        roleId: payload.roleId,
        authVersion: payload.authVersion,
        mustChangePassword: payload.mustChangePassword,
      },
      this.secret,
      {
        algorithm: "HS256",
        expiresIn: this.expiresIn,
      }
    );
  }


  verifyToken(token: string): TokenPayload {
    const decoded = jwt.verify(token, this.secret, {
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string") {
      throw new Error("Invalid token payload");
    }

    const payload = decoded as JwtPayload;

    if (
      !Number.isSafeInteger(payload.userId) ||
      payload.userId <= 0 ||
      !Number.isSafeInteger(payload.roleId) ||
      payload.roleId <= 0 ||
      !Number.isSafeInteger(payload.authVersion) ||
      payload.authVersion < 0 ||
      typeof payload.mustChangePassword !== "boolean"
    ) {
      throw new Error("Invalid token payload");
    }

    return {
      userId: payload.userId,
      roleId: payload.roleId,
      authVersion: payload.authVersion,
      mustChangePassword: payload.mustChangePassword,
    };
  }
}
