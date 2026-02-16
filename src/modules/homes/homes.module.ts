import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HomesController } from './controllers/homes.controller';
import { HomeOwnerGuard } from './guards/home-owner.guard';
import { HomeEntity } from './entities/home.entity';
import { HomesService } from './services/homes.service';

@Module({
  imports: [TypeOrmModule.forFeature([HomeEntity])],
  controllers: [HomesController],
  providers: [HomesService, HomeOwnerGuard],
  exports: [HomesService]
})
export class HomesModule {}
