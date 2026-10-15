import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export interface CurrentUserData {
  id: string;
  sub: string;
  email: string;
  role: string;
  tier?: string;
}

export type AuthenticatedUser = CurrentUserData;

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return null;
    const normalized: CurrentUserData = {
      ...user,
      id: user.sub || user.id,
      sub: user.sub || user.id,
    };
    if (data) {
      return normalized[data];
    }
    return normalized;
  }
);

