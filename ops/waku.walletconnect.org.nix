{config, pkgs ? <nixpkgs>, tag ? "master", ... }:
let
  wakuP2P = 60000;
  volumePath = "/mnt/waku-store";
  waku = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    imageDigest = "sha256:241191a639cf65a0f20fe0ca8a33ea69f733b9dd64df066765fb2245405bf53b";
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
      image = waku.imageName + ":" + waku.imageTag;
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
        "--persist-peers=true"
        "--keep-alive=true"
        "--rpc=false"
        "--relay=true"
        "--store=true"
        "--persist-messages=true"
        "--filter=true"
        "--db-path=/store"
        "--topics=6d9b0b4b9994e8a6afbd3dc3ed983cd51c755afb27cd1dc7825ef59c134a39f7"
        "--metrics-server=true"
        "--metrics-server-address=127.0.0.1"
        "--metrics-server-port=8008"
      ];
    };
  };
}
