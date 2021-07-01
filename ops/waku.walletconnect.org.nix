{config, pkgs ? <nixpkgs>, ... }:
let
  wakuP2P = 60000;
  volumePath = "/mnt/waku-store";
  wakuDocker = (import ./waku-docker.nix {});
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
      image = wakuDocker.imageName + ":" + wakuDocker.imageTag;
      ports = [ ''${toString wakuP2P}:${toString wakuP2P}'' ];
      volumes = [ 
        "${volumePath}:/store"
      ];
      cmd = [
        "--tcp-port=${toString wakuP2P}"
        "--udp-port=${toString wakuP2P}"
        "--nodekey=$(cat ${volumePath}/nodekey)"
        "--persist-peers=true"
        "--keep-alive=true"
        "--swap=false"
        "--rln-relay=false"
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
