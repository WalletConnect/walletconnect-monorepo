import * as React from "react";
import styled from "styled-components";

import { getChainMetadata } from "../chains";
import { ChainMetadata, ellipseAddress } from "../helpers";

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
  chainId: string;
  address?: string;
}

const Blockchain = (props: BlockchainProps) => {
  const { chainId, address } = props;
  let chainMeta: ChainMetadata;
  try {
    chainMeta = getChainMetadata(chainId);
  } catch (e) {
    return null;
  }
  return (
    <React.Fragment>
      <SAccount rgb={chainMeta.rgb}>
        <SChain>
          <img src={chainMeta.logo} alt={chainMeta.name} />
          <p>{chainMeta.name}</p>
        </SChain>
        {!!address && <p>{ellipseAddress(address)}</p>}
      </SAccount>
    </React.Fragment>
  );
};
export default Blockchain;
