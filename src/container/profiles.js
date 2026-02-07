/**
 * Seccomp Profiles
 * Defines syscall filtering profiles for container security
 */

/**
 * Default seccomp profile for Node.js containers
 * Allows safe system calls while blocking dangerous ones
 */
export const DEFAULT_SECCOMP_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    // Basic operations
    {
      names: [
        'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
        'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk', 'rt_sigaction',
        'rt_sigprocmask', 'rt_sigreturn', 'ioctl', 'pread64', 'pwrite64',
        'readv', 'writev', 'access', 'pipe', 'select', 'sched_yield',
        'mremap', 'msync', 'mincore', 'madvise', 'dup', 'dup2', 'pause',
        'nanosleep', 'getitimer', 'alarm', 'setitimer', 'getpid', 'sendfile',
        'socket', 'connect', 'accept', 'sendto', 'recvfrom', 'sendmsg',
        'recvmsg', 'shutdown', 'bind', 'listen', 'getsockname', 'getpeername',
        'socketpair', 'setsockopt', 'getsockopt', 'clone', 'fork', 'vfork',
        'execve', 'exit', 'wait4', 'kill', 'uname'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    },
    // Memory management
    {
      names: ['rt_sigpending', 'rt_sigtimedwait', 'rt_sigqueueinfo'],
      action: 'SCMP_ACT_ALLOW',
      args: []
    },
    // Time
    {
      names: ['gettimeofday', 'clock_gettime', 'clock_getres', 'time'],
      action: 'SCMP_ACT_ALLOW',
      args: []
    },
    // File descriptors
    {
      names: ['fcntl', 'flock', 'fsync', 'fdatasync'],
      action: 'SCMP_ACT_ALLOW',
      args: []
    },
    // Threads
    {
      names: ['getrlimit', 'setrlimit', 'getrusage', 'sysinfo', 'times', 'getuid',
        'getgid', 'setuid', 'setgid', 'geteuid', 'getegid', 'setpgid', 'getppid',
        'getpgrp', 'setsid', 'setreuid', 'setregid', 'getgroups', 'setgroups',
        'setresuid', 'getresuid', 'setresgid', 'getresgid', 'getpgid', 'setfsuid',
        'setfsgid', 'getsid', 'capget', 'capset', 'rt_sigsuspend', 'sigaltstack',
        'utime', 'mknod', 'uselib', 'personality', 'ustat', 'statfs', 'fstatfs',
        'sysfs', 'getpriority', 'setpriority', 'sched_setparam', 'sched_getparam',
        'sched_setscheduler', 'sched_getscheduler', 'sched_get_priority_max',
        'sched_get_priority_min', 'sched_rr_get_interval', 'mlock', 'munlock',
        'mlockall', 'munlockall', 'vhangup', 'pivot_root', 'prctl', 'arch_prctl',
        'adjtimex', 'setrlimit', 'chroot', 'sync', 'acct', 'settimeofday',
        'mount', 'umount2', 'swapon', 'swapoff', 'reboot', 'sethostname',
        'setdomainname', 'iopl', 'ioperm', 'init_module', 'delete_module',
        'quotactl', 'gettid', 'readahead', 'setxattr', 'lsetxattr', 'fsetxattr',
        'getxattr', 'lgetxattr', 'fgetxattr', 'listxattr', 'llistxattr',
        'flistxattr', 'removexattr', 'lremovexattr', 'fremovexattr', 'tkill',
        'time', 'futex', 'sched_setaffinity', 'sched_getaffinity', 'set_thread_area',
        'io_setup', 'io_destroy', 'io_getevents', 'io_submit', 'io_cancel',
        'get_thread_area', 'epoll_create', 'epoll_ctl', 'epoll_wait', 'remap_file_pages',
        'getdents64', 'set_tid_address', 'restart_syscall', 'semtimedop', 'fadvise64',
        'timer_create', 'timer_settime', 'timer_gettime', 'timer_getoverrun',
        'timer_delete', 'clock_settime', 'clock_nanosleep', 'exit_group', 'epoll_wait',
        'epoll_ctl', 'epoll_create', 'utimes', 'mbind', 'set_mempolicy', 'get_mempolicy',
        'mq_open', 'mq_unlink', 'mq_timedsend', 'mq_timedreceive', 'mq_notify',
        'mq_getsetattr', 'kexec_load', 'waitid', 'add_key', 'request_key', 'keyctl',
        'ioprio_set', 'ioprio_get', 'inotify_init', 'inotify_add_watch',
        'inotify_rm_watch', 'migrate_pages', 'openat', 'mkdirat', 'mknodat',
        'fchownat', 'futimesat', 'newfstatat', 'unlinkat', 'renameat', 'linkat',
        'symlinkat', 'readlinkat', 'fchmodat', 'faccessat', 'pselect6', 'ppoll',
        'unshare', 'set_robust_list', 'get_robust_list', 'splice', 'tee', 'sync_file_range',
        'vmsplice', 'move_pages', 'utimensat', 'epoll_pwait', 'signalfd', 'timerfd_create',
        'eventfd', 'fallocate', 'timerfd_settime', 'timerfd_gettime', 'accept4',
        'signalfd4', 'eventfd2', 'epoll_create1', 'dup3', 'pipe2', 'inotify_init1',
        'preadv', 'pwritev', 'rt_tgsigqueueinfo', 'perf_event_open', 'recvmmsg',
        'fanotify_init', 'fanotify_mark', 'prlimit64', 'name_to_handle_at', 'open_by_handle_at',
        'clock_adjtime', 'syncfs', 'sendmmsg', 'setns', 'getcpu', 'process_vm_readv',
        'process_vm_writev', 'kcmp', 'finit_module', 'sched_setattr', 'sched_getattr',
        'renameat2', 'seccomp', 'getrandom', 'memfd_create', 'kexec_file_load', 'bpf',
        'execveat', 'userfaultfd', 'membarrier', 'mlock2', 'copy_file_range', 'preadv2',
        'pwritev2', 'pkey_mprotect', 'pkey_alloc', 'pkey_free'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    }
  ]
};

/**
 * Restricted seccomp profile
 * Blocks more syscalls for higher security
 */
export const RESTRICTED_SECCOMP_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    {
      names: [
        'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
        'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk', 'rt_sigaction',
        'rt_sigprocmask', 'rt_sigreturn', 'ioctl', 'pread64', 'pwrite64',
        'readv', 'writev', 'access', 'pipe', 'select', 'sched_yield',
        'mremap', 'msync', 'mincore', 'madvise', 'dup', 'dup2', 'pause',
        'nanosleep', 'getitimer', 'alarm', 'setitimer', 'getpid',
        'socketpair', 'gettimeofday', 'clock_gettime', 'clock_getres', 'time',
        'getrlimit', 'setrlimit', 'getrusage', 'sysinfo', 'times',
        'getuid', 'getgid', 'geteuid', 'getegid', 'getppid', 'getpgrp',
        'gettid', 'get_thread_area', 'epoll_create', 'epoll_ctl', 'epoll_wait',
        'exit', 'exit_group'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    }
  ]
};

/**
 * Ultra-restricted seccomp profile
 * Minimal syscall set for highest security
 */
export const ULTRA_RESTRICTED_SECCOMP_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    {
      names: [
        'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
        'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk',
        'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn', 'exit', 'exit_group'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    }
  ]
};

/**
 * Network-only seccomp profile
 * Allows network operations but restricts filesystem
 */
export const NETWORK_ONLY_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    {
      names: [
        'read', 'write', 'open', 'close', 'poll', 'mmap', 'mprotect', 'munmap',
        'brk', 'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn',
        'socket', 'connect', 'accept', 'sendto', 'recvfrom', 'sendmsg',
        'recvmsg', 'shutdown', 'bind', 'listen', 'getsockname', 'getpeername',
        'socketpair', 'setsockopt', 'getsockopt', 'select', 'pipe',
        'gettimeofday', 'clock_gettime', 'time', 'getpid', 'exit', 'exit_group'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    }
  ]
};

/**
 * Compute-only seccomp profile
 * Blocks all network operations
 */
export const COMPUTE_ONLY_PROFILE = {
  defaultAction: 'SCMP_ACT_ERRNO',
  architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
  syscalls: [
    {
      names: [
        'read', 'write', 'open', 'close', 'stat', 'fstat', 'lstat',
        'poll', 'lseek', 'mmap', 'mprotect', 'munmap', 'brk',
        'rt_sigaction', 'rt_sigprocmask', 'rt_sigreturn',
        'pread64', 'pwrite64', 'readv', 'writev', 'access', 'select',
        'sched_yield', 'mremap', 'msync', 'mincore', 'madvise', 'dup', 'dup2',
        'nanosleep', 'getitimer', 'alarm', 'setitimer', 'getpid',
        'gettimeofday', 'clock_gettime', 'clock_getres', 'time',
        'getrlimit', 'setrlimit', 'getrusage', 'sysinfo', 'times',
        'getuid', 'getgid', 'geteuid', 'getegid', 'getppid', 'getpgrp',
        'gettid', 'epoll_create', 'epoll_ctl', 'epoll_wait', 'exit', 'exit_group'
      ],
      action: 'SCMP_ACT_ALLOW',
      args: []
    }
  ]
};

/**
 * Profile names mapping
 */
export const PROFILES = {
  'default': DEFAULT_SECCOMP_PROFILE,
  'restricted': RESTRICTED_SECCOMP_PROFILE,
  'ultra-restricted': ULTRA_RESTRICTED_SECCOMP_PROFILE,
  'network-only': NETWORK_ONLY_PROFILE,
  'compute-only': COMPUTE_ONLY_PROFILE
};

/**
 * Get profile by name
 */
export function getProfile(name = 'default') {
  return PROFILES[name] || DEFAULT_SECCOMP_PROFILE;
}

/**
 * Custom profile builder
 */
export class ProfileBuilder {
  constructor() {
    this.profile = JSON.parse(JSON.stringify(DEFAULT_SECCOMP_PROFILE));
  }

  /**
   * Allow syscall
   */
  allow(syscallName, args = []) {
    // Remove from denied list if present
    this.profile.syscalls = this.profile.syscalls.filter(
      s => s.action !== 'SCMP_ACT_ERRNO' || !s.names.includes(syscallName)
    );

    // Add to allowed list
    const allowBlock = this.profile.syscalls.find(s => s.action === 'SCMP_ACT_ALLOW');
    if (allowBlock && !allowBlock.names.includes(syscallName)) {
      allowBlock.names.push(syscallName);
    }

    return this;
  }

  /**
   * Deny syscall
   */
  deny(syscallName, errno = 'EPERM') {
    // Remove from allowed list
    for (const block of this.profile.syscalls) {
      if (block.action === 'SCMP_ACT_ALLOW') {
        block.names = block.names.filter(n => n !== syscallName);
      }
    }

    // Add to denied list
    const denyBlock = this.profile.syscalls.find(s => s.action === 'SCMP_ACT_ERRNO');
    if (denyBlock && !denyBlock.names.includes(syscallName)) {
      denyBlock.names.push(syscallName);
    }

    return this;
  }

  /**
   * Set default action
   */
  setDefaultAction(action) {
    this.profile.defaultAction = action;
    return this;
  }

  /**
   * Build final profile
   */
  build() {
    return this.profile;
  }
}

/**
 * Validate profile structure
 */
export function validateProfile(profile) {
  const required = ['defaultAction', 'architectures', 'syscalls'];
  const missing = required.filter(key => !profile[key]);

  if (missing.length > 0) {
    throw new Error(`Invalid profile: missing keys: ${missing.join(', ')}`);
  }

  if (!Array.isArray(profile.syscalls)) {
    throw new Error('Invalid profile: syscalls must be an array');
  }

  return true;
}

/**
 * Merge multiple profiles
 */
export function mergeProfiles(...profiles) {
  const merged = {
    defaultAction: 'SCMP_ACT_ERRNO',
    architectures: ['SCMP_ARCH_X86_64', 'SCMP_ARCH_X86', 'SCMP_ARCH_X32'],
    syscalls: []
  };

  const allowed = new Set();
  const denied = new Set();

  for (const profile of profiles) {
    if (!profile.syscalls) continue;

    for (const block of profile.syscalls) {
      if (block.action === 'SCMP_ACT_ALLOW') {
        block.names.forEach(n => {
          allowed.add(n);
          denied.delete(n);
        });
      } else if (block.action === 'SCMP_ACT_ERRNO') {
        block.names.forEach(n => {
          denied.add(n);
          allowed.delete(n);
        });
      }
    }
  }

  // Create merged blocks
  if (allowed.size > 0) {
    merged.syscalls.push({
      names: Array.from(allowed),
      action: 'SCMP_ACT_ALLOW',
      args: []
    });
  }

  if (denied.size > 0) {
    merged.syscalls.push({
      names: Array.from(denied),
      action: 'SCMP_ACT_ERRNO',
      args: []
    });
  }

  return merged;
}

/**
 * Get profile statistics
 */
export function getProfileStats(profile) {
  const stats = {
    totalSyscalls: 0,
    allowedSyscalls: 0,
    deniedSyscalls: 0,
    architectures: profile.architectures?.length || 0
  };

  if (profile.syscalls) {
    for (const block of profile.syscalls) {
      stats.totalSyscalls += block.names.length;
      if (block.action === 'SCMP_ACT_ALLOW') {
        stats.allowedSyscalls += block.names.length;
      } else {
        stats.deniedSyscalls += block.names.length;
      }
    }
  }

  return stats;
}

export default {
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
};
