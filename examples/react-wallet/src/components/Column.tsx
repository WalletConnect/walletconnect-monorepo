import * as React from "react";
import styled from "styled-components";

const SColumn = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const Column = (props: any) => <SColumn {...props}>{props.children}</SColumn>;

export default Column;
