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

    if [[ ! -e /key/nodekey ]]; then
      # https://stackoverflow.com/a/34329799
      ${coreutils}/bin/od  -vN "32" -An -tx1 /dev/urandom | tr -d " \n" > /key/nodekey
    fi

    /usr/bin/wakunode --nodekey=$(cat /key/nodekey) --rpc=true --rpc-address=0.0.0.0 > /dev/null 2>&1 &
    PID=$!
    sleep 5

    wakuWC=$(${dnsutils}/bin/dig +short waku.walletconnect.org | ${coreutils}/bin/tr -d '\n')
    echo $SWARM_PEERS
    while ! ${dnsutils}/bin/dig +short $SWARM_PEERS; do
      sleep 1
    done
    peerIPs=$(${dnsutils}/bin/dig +short $SWARM_PEERS)
    echo "SUP $peerIPs"
    peersArgs=""
    for ip in $peerIPs; do
      echo "IP $ip"
      while [ true ]; do
         ${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://$ip:8545
         result=$(${curl}/bin/curl -s -d '{"jsonrpc":"2.0","id":"id","method":"get_waku_v2_debug_v1_info", "params":[]}' --header "Content-Type: application/json" http://$ip:8545)
         echo "Result $result"
         multiaddr=$(echo -n $result | ${jq}/bin/jq -r '.result.listenStr')
         echo "Multiaddr $multiaddr"
         if [[ -n $multiaddr ]]; then
           multiaddr=$(sed "s/0\.0\.0\.0/$ip/g" <<< $multiaddr)
           peersArgs="$peersArgs --staticnode=$multiaddr"
           break
         fi
         sleep 3
         echo -n .
      done
    done


    echo "PID $PID"
    kill $PID
    peersArgs="$peersArgs --staticnode=$STORE"

    echo "ALL $peersArgs"

    run="/usr/bin/wakunode \
      --nodekey=$(cat /key/nodekey) \
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
      $peersArgs
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
