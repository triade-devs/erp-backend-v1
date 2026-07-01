import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { EnvConfig } from '../common/config/env.validation.js';
import type {
  EmpresaResponse,
  CepResponse,
  BarcodeResponse,
  NcmResult,
} from './interfaces/enrichment-responses.interface.js';

/**
 * EnrichmentService — Cliente HTTP interno para os 4 microserviços de enriquecimento.
 *
 * Contrato de resiliência aplicado uniformemente:
 * - Timeout: 2500ms (configurado no HttpModule).
 * - Fallback: retorna `null` (ou `[]` para NCM) silenciosamente — nunca lança exceção.
 * - O controller trata `null` como "enriquecimento indisponível, usuário preenche manualmente".
 *
 * Sem rotas públicas — módulo de infraestrutura consumido por Suppliers e Inventory.
 */
@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);

  private readonly empresaUrl: string | undefined;
  private readonly cepUrl: string | undefined;
  private readonly barcodeUrl: string | undefined;
  private readonly ncmUrl: string | undefined;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService<EnvConfig>,
  ) {
    this.empresaUrl = this.configService.get('ENRICHMENT_EMPRESA_URL', { infer: true });
    this.cepUrl = this.configService.get('ENRICHMENT_CEP_URL', { infer: true });
    this.barcodeUrl = this.configService.get('ENRICHMENT_BARCODE_URL', { infer: true });
    this.ncmUrl = this.configService.get('ENRICHMENT_NCM_URL', { infer: true });
  }

  /**
   * Consulta dados de empresa por CNPJ.
   * Retorna `null` se o serviço estiver indisponível ou a URL não estiver configurada.
   */
  async lookupEmpresa(cnpj: string): Promise<EmpresaResponse | null> {
    if (!this.empresaUrl) {
      this.logger.debug('ENRICHMENT_EMPRESA_URL não configurada — retornando null');
      return null;
    }

    try {
      const cleanCnpj = cnpj.replace(/\D/g, '');
      const { data } = await firstValueFrom(
        this.httpService.get<EmpresaResponse>(`${this.empresaUrl}/${cleanCnpj}`),
      );
      return data;
    } catch (error) {
      this.logger.warn(`Falha ao consultar empresa (CNPJ: ${cnpj}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Consulta endereço por CEP.
   * Retorna `null` se o serviço estiver indisponível ou a URL não estiver configurada.
   */
  async lookupCep(cep: string): Promise<CepResponse | null> {
    if (!this.cepUrl) {
      this.logger.debug('ENRICHMENT_CEP_URL não configurada — retornando null');
      return null;
    }

    try {
      const cleanCep = cep.replace(/\D/g, '');
      const { data } = await firstValueFrom(
        this.httpService.get<CepResponse>(`${this.cepUrl}/${cleanCep}`),
      );
      return data;
    } catch (error) {
      this.logger.warn(`Falha ao consultar CEP (${cep}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Consulta dados de produto por código de barras (EAN/GTIN).
   * Retorna `null` se o serviço estiver indisponível ou a URL não estiver configurada.
   */
  async lookupBarcode(ean: string): Promise<BarcodeResponse | null> {
    if (!this.barcodeUrl) {
      this.logger.debug('ENRICHMENT_BARCODE_URL não configurada — retornando null');
      return null;
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<BarcodeResponse>(`${this.barcodeUrl}/${ean}`),
      );
      return data;
    } catch (error) {
      this.logger.warn(`Falha ao consultar barcode (EAN: ${ean}): ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Consulta NCMs por texto (autocomplete).
   * Retorna `[]` se o serviço estiver indisponível ou a URL não estiver configurada.
   */
  async lookupNcm(q: string): Promise<NcmResult[]> {
    if (!this.ncmUrl) {
      this.logger.debug('ENRICHMENT_NCM_URL não configurada — retornando []');
      return [];
    }

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<NcmResult[]>(this.ncmUrl, { params: { q } }),
      );
      return data ?? [];
    } catch (error) {
      this.logger.warn(`Falha ao consultar NCM (q: ${q}): ${(error as Error).message}`);
      return [];
    }
  }
}
