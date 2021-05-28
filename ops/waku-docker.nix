{
  pkgs ? import (import ../servers/relay/nix/sources.nix).nixpkgs {},
  tag ? "walletconnect"
}:
let
  statusImage = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    imageDigest = "sha256:84996a5107a67c2d2edd44fa00125107a36b674fa3dab3582f8ab36f688cafef";
    sha256 = "0ljhvvnhbdadk9bxp74rdbqcshmsw525wprbakfgzfdn6smml608";
  };
  entry-script = with pkgs; writeScript "entry-script.sh" ''
    #!${runtimeShell}
    set -e
    wakuWC=$(${dnsutils}/bin/dig +short waku.walletconnect.org | ${coreutils}/bin/tr -d '\n')
    replicas=$${REPLICAS:-1}
    peerArgs=""
    for p in $PEERS; do
      peersArgs="$peersArgs --staticnode=$p"
    done

    peerArgs="$peerArgs --staticnode=$STORE"

    run="/usr/bin/wakunode \
      --keep-alive=true \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --persist-peers=true \
      --metrics-server=true \
      --metrics-server-address=0.0.0.0 \
      --metrics-server-port=9001 \
      --relay=true \
      --store=true \
      --db-path=/store \
      $peerArgs
    "

    printf "\n\nCommand: $run\n\n"
    exec $run

  '';
in
{
  statusImage = statusImage;
  docker = pkgs.dockerTools.buildImage {
    name =  statusImage.imageName;
    fromImage = statusImage;
    fromImageName = statusImage.finalImageName;
    fromImageTag = statusImage.finalImageTag;
    contents = pkgs.bash;
    created = "now";
    config = {
      Cmd = [
        "${entry-script}"
      ];
    };
  };
}
