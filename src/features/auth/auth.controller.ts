import { Body, Controller, Post, Request, UsePipes } from '@nestjs/common';
import { Public } from '../../shared/decorators/public.decorator';
import {
  JsonApiResource,
  jsonApiData,
  jsonApiMeta,
} from '../../shared/jsonapi/jsonapi';
import { ZodValidationPipe } from '../../shared/pipes/zod-validation.pipe';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
} from '../../shared/schemas';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.input';
import { LoginDto } from './dto/login.input';
import { RegisterDto } from './dto/register.input';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Public()
  @Post('/register')
  @UsePipes(
    new ZodValidationPipe({
      body: registerSchema,
    }),
  )
  async register(@Body() input: RegisterDto) {
    const user = await this.authService.register(input);
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        access_token: user.access_token,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
    return jsonApiData(resource);
  }

  @Public()
  @Post('/login')
  @UsePipes(
    new ZodValidationPipe({
      body: loginSchema,
    }),
  )
  async login(@Body() input: LoginDto) {
    const user = await this.authService.login(input);
    const resource: JsonApiResource<Record<string, unknown>> = {
      type: 'users',
      id: user.id,
      attributes: {
        name: user.name,
        email: user.email,
        role: user.role,
        access_token: user.access_token,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    };
    return jsonApiData(resource);
  }

  @Post('/password')
  @UsePipes(
    new ZodValidationPipe({
      body: changePasswordSchema,
    }),
  )
  async changePassword(@Request() req, @Body() input: ChangePasswordDto) {
    const message = await this.authService.changePassword(req.user.id, input);
    return jsonApiMeta({ message });
  }
}
