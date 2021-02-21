import * as React from "react";
import styled from "styled-components";

import Icon from "./Icon";

import { AssetData, fromWad } from "../helpers";

import eth from "../assets/eth.svg";
import xdai from "../assets/xdai.png";
import matic from "../assets/matic.png";
import erc20 from "../assets/erc20.svg";

const SAsset = styled.div`
  width: 100%;
  padding: 20px;
  display: flex;
  justify-content: space-between;
`;
const SAssetLeft = styled.div`
  display: flex;
`;

const SAssetName = styled.div`
  display: flex;
  margin-left: 10px;
`;

const SAssetRight = styled.div`
  display: flex;
`;

const SAssetBalance = styled.div`
  display: flex;
`;

function getAssetIcon(asset: AssetData): JSX.Element {
  if (!!asset.contractAddress) {
    const src = `https://raw.githubusercontent.com/TrustWallet/tokens/master/tokens/${asset.contractAddress.toLowerCase()}.png`;
    return <Icon src={src} fallback={erc20} />;
  }
  switch (asset.symbol.toLowerCase()) {
    case "eth":
      return <Icon src={eth} />;
    case "xdai":
      return <Icon src={xdai} />;
    case "matic":
      return <Icon src={matic} />;
    default:
      return <Icon src={erc20} />;
  }
}

interface AssetProps {
  asset: AssetData;
}

const Asset = (props: AssetProps) => {
  const { asset } = props;
  return (
    <SAsset {...props}>
      <SAssetLeft>
        {getAssetIcon(asset)}
        <SAssetName>{asset.name}</SAssetName>
      </SAssetLeft>
      <SAssetRight>
        <SAssetBalance>{`${fromWad(asset.balance || "0")} ${asset.symbol}`}</SAssetBalance>
      </SAssetRight>
    </SAsset>
  );
};

export default Asset;
