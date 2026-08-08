import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { PaginationDto } from 'src/common/pagination';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AvailableMaidQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Homeowner Latitude (optional if saved in profile)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: 'Homeowner Longitude (optional if saved in profile)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: 'Alias for latitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional({ description: 'Alias for longitude' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;

  @ApiPropertyOptional({ description: 'Maximum distance range in km (default 40km)', default: 40 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  maxDistanceKm?: number;

  @ApiPropertyOptional({ description: 'Alias for maxDistanceKm (radius in km)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  radius?: number;
}
