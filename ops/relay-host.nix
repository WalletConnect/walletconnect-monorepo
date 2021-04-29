{pkgs, config, ...}:

{
  virtualisation.docker.package = (import (import ../servers/relay/nix/sources.nix).nixpkgs {}).docker_20_10;
  boot.kernel.sysctl = {
    "fs.file-max" = "1000000";
    "fs.nr_open" = "1048576";
    "net.ipv4.ip_local_port_range"= "1024 65535";
    "net.ipv4.netfilter.ip_conntrack_max" = "1048576";
    "net.core.somaxconn" = "1024";
    "net.nf_conntrack_max" = "1048576";
    "net.core.rmem_max" = "33554432";
    "net.core.wmem_max" = "33554432";
    "net.ipv4.tcp_rmem" = "4096 16384 33554432";
    "net.ipv4.tcp_wmem" = "4096 16384 33554432";
    "net.ipv4.tcp_mem" = "786432 1048576 26777216";
    "net.ipv4.tcp_max_tw_buckets" = "360000";
    "net.core.netdev_max_backlog" = "2500";
    "vm.min_free_kbytes" = "65536";
    "vm.swappiness" = "0";
  };
  services.fail2ban = {
    enable = true;
    ignoreIP = [ "127.0.0.1" ];
  };
  nix = {
    binaryCaches = [
      "https://walletconnect.cachix.org"
      "https://cache.nixos.org/"
    ];
    binaryCachePublicKeys = [
      "walletconnect.cachix.org-1:gOjJFP3ijKWCpRP4Oax2IWxK8nCLJIt047NCBMtMYNQ="
    ];
  };
}
