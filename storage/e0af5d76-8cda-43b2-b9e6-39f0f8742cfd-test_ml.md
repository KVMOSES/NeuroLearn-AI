# Introduction to Recurrent Neural Networks

Recurrent Neural Networks (RNNs) process sequential data by maintaining a hidden state across time steps. Unlike feedforward networks, RNNs share parameters across all time steps.

## The Vanishing Gradient Problem
Vanilla RNNs struggle with long sequences because gradients either vanish or explode during backpropagation through time. This led to LSTM (Long Short-Term Memory) and GRU (Gated Recurrent Unit) architectures.

## LSTM
LSTM cells contain three gates: input, forget, and output. These gates selectively update and forget information, allowing the network to maintain long-range dependencies.

## Applications
RNNs are used for language modeling, machine translation, speech recognition, and time series prediction. However, transformers have largely replaced RNNs for sequence tasks due to better parallelization.
