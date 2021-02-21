import * as React from "react";
import styled, { keyframes } from "styled-components";
import { fonts, colors } from "../styles";

interface LoaderStyleProps {
  size: number;
  color: string;
  background: string;
}

const load = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const SLoader = styled.div<LoaderStyleProps>`
  position: relative;
  font-size: ${fonts.size.tiny};
  margin: 0 auto;
  text-indent: -9999em;
  width: ${({ size }) => `${size}px`};
  height: ${({ size }) => `${size}px`};
  border-radius: 50%;
  background: ${({ color }) => `rgb(${colors[color]})`};
  background: ${({ background, color }) =>
    `linear-gradient(to right, rgb(${colors[color]}) 10%, rgba(${colors[background]}, 0) 42%)`};
  animation: ${load} 1s infinite linear;
  transform: translateZ(0);

  &:before {
    width: 50%;
    height: 50%;
    background: ${({ color }) => `rgb(${colors[color]})`};
    border-radius: 100% 0 0 0;
    position: absolute;
    top: 0;
    left: 0;
    content: "";
  }

  &:after {
    background: ${({ background }) => `rgb(${colors[background]})`};
    width: 75%;
    height: 75%;
    border-radius: 50%;
    content: "";
    margin: auto;
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    right: 0;
  }
`;

const Loader = (props: LoaderStyleProps) => (
  <SLoader {...props} size={props.size} color={props.color} background={props.background} />
);

Loader.defaultProps = {
  size: 50,
  color: "defaultColor",
  background: "white",
};

export default Loader;
