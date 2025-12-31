import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/auth/guards/jwt-auth.guard';
import { ApiJwtAuth } from '@/core/decorators/api-jwt-auth.decorator';
import { AIModelItemDto } from './dto/ai-model-item.dto';
import { AIRequestDto } from './dto/ai-request.dto';
import { AIResponseDto } from './dto/ai-response.dto';
import { AIService } from './services/ai.service';

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
  @ApiOperation({ summary: 'List all available models from all providers' })
  @ApiOkResponse({
    type: AIModelItemDto,
    isArray: true,
  })
  listAllModels(): Promise<AIModelItemDto[]> {
    return this.aiService.listAllModels();
  }
}
