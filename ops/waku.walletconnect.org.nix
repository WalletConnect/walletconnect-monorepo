{config, pkgs ? <nixpkgs>, ... }:
let
  image="walletconnect/waku";
  tag="master";
  wakuP2P = 60000;
in {
  networking = {
    firewall = {
      enable = true;
      allowedTCPPorts = [ 22 80 443 ] // wakuPorts;
    };
  };
  services.fail2ban = {
    enable = true;
    ignoreIP = [ "127.0.0.1" ];
  };

  virtualisation.oci-containers.backend = "docker";
  virtualisation.oci-containers.containers = {
    "store-waku" = {
      image = pkgs.dockerTools.pullImage {
        imageName = image;
        finalImageTag = tag;
        imageDigest = "sha256:9b7f0ce6d1c59dd9ebc418b729a71b21f24ef2bb384b50977861b661250002f1";
        sha256 = "000003zq2v6rrhizgb9nvhczl87lcfphq9601wcprdika2jz7qh8";
      };
      ports = [
        ''${wakuP2P}:${wakuP2P}''
      ];
      volumes = [
        "/mnt/waku-store:/store"
      ];
      cmd = [
        "--nodekey=1107ad8e44fe7dc924bb9d388d588832cdc4273efb2623e8609c8085d0d2154c"
        "--peerpersist=true"
        "--rpc=false"
        "--relay=true"
        "--store=true"
        "--filter=true"
        "--dbpath=/store"
        "--topics=6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7"
      ];
    };
  };
}
