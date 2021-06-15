{
  pkgs ? import (import ./nix/sources.nix).nixpkgs {},
  tag ? "master"
}:
let
  statusImage = pkgs.dockerTools.pullImage {
    imageName = "walletconnect/waku";
    finalImageTag = tag;
    # docker image inspect walletconnect/waku:walletconnect --format "{{index .RepoDigests 0}}" | cut -d "@" -f2
    imageDigest = "sha256:f6afa100413076638b63c84f3172fea0e0eafddb48e2d9f211ab85ab451ab20f";
    # If you can find out how to get the RIGHT tar file you can use 
    # nix-hash --type sha256 --flat --base32 pmjdag6jmsm6vm8lcfrbwaa63ccx44zy-docker-image-walletconnect-waku-walletconnect.tar
    # to get the value of sha256
    sha256 = "0d5myzg5jjnkjv4qsdkjxb5mkzrwiqdr6jzcvccd3xhl4cimai73";
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
    sleep 10 # wait for rpc server to start

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


    kill $PID
    peersArgs="$peersArgs --staticnode=$STORE"

    echo "ALL $peersArgs"

    run="/usr/bin/wakunode \
      --nodekey=$(cat /key/nodekey) \
      --keep-alive=true \
      --swap=false \
      --rln-relay=false \
      --rpc=true \
      --rpc-address=0.0.0.0 \
      --persist-peers=true \
      --metrics-server=true \
      --metrics-server-address=0.0.0.0 \
      --metrics-server-port=9001 \
      --relay=true \
      --store=true \
      --db-path=/store \
      --storenode=$STORE \
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
