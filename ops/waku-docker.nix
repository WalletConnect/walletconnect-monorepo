{
  pkgs ? import (import ../servers/relay/nix/sources.nix).nixpkgs {},
  tag ? "walletconnect"
}:
let
  statusImage = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    # docker image inspect walletconnect/waku:walletconnect --format "{{index .RepoDigests 0}}" | cut -d "@" -f2
    imageDigest = "sha256:46a3e87f1692ac54fe4cdd4313ff2d78d1849d03512ab99f49615c0d8425ea48";
    # If you can find out how to get the RIGHT tar file you can use 
    # nix-hash --type sha256 --flat --base32 pmjdag6jmsm6vm8lcfrbwaa63ccx44zy-docker-image-walletconnect-waku-walletconnect.tar
    # to get the value of sha156
    sha256 = "11xfdqpxj6wrj3ii32kn2wld727vm23r46wgn1vcdpl1xp76fzp9";
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
    sleep 15 # wait for rpc server to start

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
