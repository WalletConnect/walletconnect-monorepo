{config, pkgs ? <nixpkgs>, tag ? "master", ... }:
let
  wakuP2P = 60000;
  volumePath = "/mnt/waku-store";
  waku = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    imageDigest = "sha256:fe01e0c11fce793f2b80eba3e5c7a0d1976c9b30be790c33af8a50fe261714ff";
    sha256 = "000003zq2v6rrhizgb9nvhczl87lcfphq9601wcprdika2jz7qh8";
  };
in {
  networking = {
    firewall = {
      enable = true;
      allowedTCPPorts = [ 22 80 443 wakuP2P ];
      allowedUDPPorts = [ wakuP2P ];
    };
  };
  services.fail2ban = {
    enable = true;
    ignoreIP = [ "127.0.0.1" ];
  };

  fileSystems."${volumePath}" = { 
    device = "/dev/disk/by-uuid/a18cf05c-88b1-461f-8a05-7fd0c8dc0e35";
    fsType = "ext4";
 };

  virtualisation.oci-containers.backend = "docker";
  virtualisation.oci-containers.containers = {
    "store-waku" = {
      image = waku.imageName + ":" + waku.finalImageTag;
      ports = [
        ''${toString wakuP2P}:${toString wakuP2P}''
      ];
      volumes = [
        "${volumePath}:/store"
      ];
      cmd = [
        "--tcp-port=${toString wakuP2P}"
        "--udp-port=${toString wakuP2P}"
        "--nodekey=1107ad8e44fe7dc924bb9d388d588832cdc4273efb2623e8609c8085d0d2154c"
        "--peerpersist=true"
        "--keep-alive=true"
        "--rpc=false"
        "--relay=true"
        "--store=true"
        "--persist-messages=true"
        "--filter=true"
        "--dbpath=/store"
        "--topics=6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7"
      ];
    };
  };
}
