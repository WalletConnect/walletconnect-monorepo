import * as React from "react";
import * as blockies from "blockies-ts";
import styled from "styled-components";

interface BlockieStyleProps {
  size: number;
}

interface BlockieProps extends BlockieStyleProps {
  address: string;
}

const SBlockieWrapper = styled.div<BlockieStyleProps>`
  width: ${({ size }) => `${size}px`};
  height: ${({ size }) => `${size}px`};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  & img {
    width: 100%;
  }
`;

const Blockie = (props: BlockieProps) => {
  const seed = props.address.toLowerCase() || "";
  const imgUrl = blockies
    .create({
      seed,
    })
    .toDataURL();
  return (
    <SBlockieWrapper {...props} size={props.size}>
      <img src={imgUrl} alt={props.address} />
    </SBlockieWrapper>
  );
};

Blockie.defaultProps = {
  address: "0x0000000000000000000000000000000000000000",
  size: 30,
};

export default Blockie;
