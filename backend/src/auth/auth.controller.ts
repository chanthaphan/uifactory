import { BadRequestException, Body, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SettingsService } from '../settings/settings.service';
import { CurrentUser, Public } from './auth.decorators';
import { AuthUser, OIDC_STATE_COOKIE } from './auth.types';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get('config')
  async config() {
    const s = await this.settings.get();
    return {
      mode: this.auth.mode(),
      platformName: s.platformName,
      platformLogo: s.platformLogo,
      platformBrandColor: s.platformBrandColor,
    };
  }

  @Public()
  @Get('me')
  me(@CurrentUser() user?: AuthUser) {
    return { user: user ?? null };
  }

  @Post('logout')
  @Public()
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(this.auth.cookieName, { path: '/' });
    return { ok: true };
  }

  // ---- Dev mock auth ----

  @Public()
  @Get('dev-users')
  devUsers() {
    return this.auth.devUsers();
  }

  @Public()
  @Post('dev-login')
  async devLogin(@Body('email') email: string, @Res({ passthrough: true }) res: Response) {
    if (!email) throw new BadRequestException('email is required');
    const user = await this.auth.devLogin(email);
    res.cookie(this.auth.cookieName, this.auth.signSession(user), this.auth.cookieOptions());
    return { user };
  }

  // ---- Azure AD OIDC ----

  @Public()
  @Get('login')
  login(@Res() res: Response) {
    if (!this.auth.isAzure()) {
      return res.redirect(`${FRONTEND_URL}/login`);
    }
    const state = randomBytes(16).toString('hex');
    const nonce = randomBytes(16).toString('hex');
    res.cookie(OIDC_STATE_COOKIE, `${state}.${nonce}`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.auth.buildAuthorizeUrl(state, nonce));
  }

  @Public()
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cookie = (req.cookies?.[OIDC_STATE_COOKIE] as string) || '';
    const [expectedState, nonce] = cookie.split('.');
    if (!code || !state || state !== expectedState) {
      return res.redirect(`${FRONTEND_URL}/login?error=state`);
    }
    try {
      const idToken = await this.auth.exchangeCodeForIdToken(code);
      const profile = await this.auth.verifyIdToken(idToken, nonce);
      const user = await this.auth.upsertUser(profile);
      res.clearCookie(OIDC_STATE_COOKIE, { path: '/' });
      res.cookie(this.auth.cookieName, this.auth.signSession(user), this.auth.cookieOptions());
      return res.redirect(`${FRONTEND_URL}/`);
    } catch {
      return res.redirect(`${FRONTEND_URL}/login?error=auth`);
    }
  }
}
