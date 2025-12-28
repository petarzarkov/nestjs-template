import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { AIService } from './ai.service';
import { AIRequestDto } from './dto/ai-request.dto';
import { AIResponseDto } from './dto/ai-response.dto';
import { ListModelsQueryDto } from './dto/list-models-query.dto';

@ApiTags('ai')
@Controller('ai')
@ApiJwtAuth()
@UseGuards(JwtAuthGuard)
export class AIController {
  constructor(private readonly aiService: AIService) {}

  @Post('query')
  @ApiOperation({ summary: 'Query an AI provider' })
  @ApiBody({ type: AIRequestDto })
  @ApiOkResponse({ type: AIResponseDto })
  query(@Body() request: AIRequestDto): Promise<AIResponseDto> {
    return this.aiService.queryProvider(
      request.provider,
      request.model,
      request.prompt,
    );
  }

  @Get('models')
  @ApiOperation({ summary: 'List available models from the AI provider' })
  listModels(@Query() query: ListModelsQueryDto): Promise<string[]> {
    return this.aiService.listModels(query.provider);
  }
}
