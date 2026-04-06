import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { getNumber, getRequiredString } from '../../shared/config/config.utils';

const createConnectionOptions = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  return {
    type: 'mysql',
    host: configService.get<string>('MYSQL_HOST') ?? 'localhost',
    port: getNumber(configService, 'MYSQL_PORT', 3306),
    username: getRequiredString(configService, 'MYSQL_USER'),
    password: configService.get<string>('MYSQL_PASS') ?? '',
    database: getRequiredString(configService, 'MYSQL_DB'),
    synchronize: true,
    migrationsRun: true,
    autoLoadEntities: true,
  };
};

export default createConnectionOptions;
