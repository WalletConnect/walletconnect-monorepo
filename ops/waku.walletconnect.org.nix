{config, pkgs ? <nixpkgs>, tag ? "master", ... }:
let
  wakuP2P = 60000;
  volumePath = "/mnt/waku-store";
  statusImage = (import ./waku-docker.nix {}).statusImage;
in {
  networking = {
    firewall = {
      enable = true;
      allowedTCPPorts = [ 22 80 443 wakuP2P ];
      allowedUDPPorts = [ wakuP2P ];
    };
  };
  fileSystems."${volumePath}" = { 
    device = "/dev/disk/by-uuid/a18cf05c-88b1-461f-8a05-7fd0c8dc0e35";
    fsType = "ext4";
 };

  virtualisation.oci-containers.backend = "docker";
  virtualisation.oci-containers.containers = {
    "store-waku" = {
      image = statusImage.imageName + ":" + statusImage.imageTag;
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
        "--topics=/waku/2/walletconnect/proto"
        "--metrics-server=true"
        "--metrics-server-address=127.0.0.1"
        "--metrics-server-port=8008"
      ];
    };
  };
}
