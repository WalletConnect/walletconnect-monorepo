import * as React from "react";
import styled from "styled-components";
import { ChainData } from "caip-api";

import { getChainMetadata } from "../chains";
import { ChainMetadata, ChainNamespaces, ellipseAddress } from "../helpers";

interface AccountStyleProps {
  rgb: string;
}

const SAccount = styled.div<AccountStyleProps>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 8px;
  padding: 8px;
  margin: 5px 0;
  border: ${({ rgb }) => `2px solid rgb(${rgb})`};
  &.active {
    box-shadow: ${({ rgb }) => `0 0 8px rgb(${rgb})`};
  }
`;

const SChain = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  & p {
    font-weight: 600;
  }
  & img {
    border-radius: 50%;
    width: 35px;
    height: 35px;
    margin-right: 10px;
  }
`;

interface BlockchainProps {
  chainData: ChainNamespaces;
  chainId: string;
  address?: string;
}

interface BlockchainDisplayData {
  data: ChainData;
  meta: ChainMetadata;
}

function getBlockchainDisplayData(
  chainId: string,
  chainData: ChainNamespaces,
): BlockchainDisplayData | undefined {
  const [namespace, reference] = chainId.split(":");
  let meta: ChainMetadata;
  try {
    meta = getChainMetadata(chainId);
  } catch (e) {
    return undefined;
  }
  const data: ChainData = chainData[namespace][reference];
  if (typeof data === "undefined") return undefined;
  return { data, meta };
}

const Blockchain = (props: BlockchainProps) => {
  const { chainData, chainId, address } = props;
  if (!Object.keys(chainData).length) return null;
  const chain = getBlockchainDisplayData(chainId, chainData);
  if (typeof chain === "undefined") return null;
  const name = chain.meta.name || chain.data.name;
  return (
    <React.Fragment>
      <SAccount rgb={chain.meta.rgb}>
        <SChain>
          <img src={chain.meta.logo} alt={name} />
          <p>{name}</p>
        </SChain>
        {!!address && <p>{ellipseAddress(address)}</p>}
      </SAccount>
    </React.Fragment>
  );
};
export default Blockchain;
