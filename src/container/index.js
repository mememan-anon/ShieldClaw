/**
 * Container & eBPF Module
 * Main entry point for containerization and eBPF utilities
 */

export { ContainerManager } from './manager.js';
export { EBPFLoader } from './ebpf-loader.js';
export {
  DEFAULT_SECCOMP_PROFILE,
  RESTRICTED_SECCOMP_PROFILE,
  ULTRA_RESTRICTED_SECCOMP_PROFILE,
  NETWORK_ONLY_PROFILE,
  COMPUTE_ONLY_PROFILE,
  PROFILES,
  getProfile,
  ProfileBuilder,
  validateProfile,
  mergeProfiles,
  getProfileStats
} from './profiles.js';

export default {
  ContainerManager,
  EBPFLoader,
  profiles: {
    DEFAULT_SECCOMP_PROFILE,
    RESTRICTED_SECCOMP_PROFILE,
    ULTRA_RESTRICTED_SECCOMP_PROFILE,
    NETWORK_ONLY_PROFILE,
    COMPUTE_ONLY_PROFILE,
    PROFILES,
    getProfile,
    ProfileBuilder,
    validateProfile,
    mergeProfiles,
    getProfileStats
  }
};
