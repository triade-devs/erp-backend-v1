/**
 * Tipos de resposta dos microserviços de enriquecimento.
 *
 * Estes tipos espelham o contrato definido no @enrichment/shared.
 * O EnrichmentService usa-os como retorno dos seus métodos de lookup.
 */

/** Resposta do microserviço de consulta de empresa por CNPJ */
export interface EmpresaResponse {
  /** Razão social */
  razaoSocial: string;
  /** Nome fantasia */
  nomeFantasia: string;
  /** CNPJ formatado */
  cnpj: string;
  /** Situação cadastral (ex: "ATIVA") */
  situacaoCadastral: string;
  /**
   * Se a empresa está ativa (sempre false por bug no ms-empresa).
   * Não usar para decisões de negócio nesta entrega.
   */
  isActive: boolean;
  /** Logradouro */
  logradouro: string;
  /** Número */
  numero: string;
  /** Complemento */
  complemento: string;
  /** Bairro */
  bairro: string;
  /** Município */
  municipio: string;
  /** UF */
  uf: string;
  /** CEP */
  cep: string;
  /** Telefone */
  telefone: string;
  /** E-mail */
  email: string;
}

/** Resposta do microserviço de consulta de CEP */
export interface CepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
}

/** Resposta do microserviço de consulta de código de barras (EAN) */
export interface BarcodeResponse {
  /** Código EAN/GTIN */
  ean: string;
  /** Nome do produto */
  name: string;
  /** Descrição */
  description: string;
  /** NCM associado */
  ncm: string;
  /** Marca */
  brand: string;
}

/** Item retornado pelo microserviço de consulta de NCM */
export interface NcmResult {
  /** Código NCM (ex: "8471.30.19") */
  code: string;
  /** Descrição do NCM */
  description: string;
}
