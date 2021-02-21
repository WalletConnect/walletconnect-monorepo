import * as React from "react";
import styled from "styled-components";

import { colors } from "../styles";

interface CardStyleProps {
  maxWidth: number;
}

interface CardProps extends CardStyleProps {
  children: React.ReactNode;
}

const SCard = styled.div<CardStyleProps>`
  width: 100%;
  max-width: ${({ maxWidth }) => `${maxWidth}px`};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background: rgb(${colors.white});
  color: rgb(${colors.defaultColor});
  border-radius: 6px;
  padding: 20px;
`;

const Card = (props: CardProps) => {
  return (
    <SCard {...props} maxWidth={props.maxWidth}>
      {props.children}
    </SCard>
  );
};

Card.defaultProps = {
  maxWidth: 400,
};

export default Card;
