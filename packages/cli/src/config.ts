// Re-export config utilities from shared package
export {
  type FluxConfig,
  findFluxDir,
  loadEnvLocal,
  readConfig,
  readConfigRaw,
  writeConfig,
  resolveDataPath,
} from '@flux/shared/config';
