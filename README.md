# Keep That Music Alive

An interactive browser-based system where music is generated and sustained through body movement.

## Overview

This project explores how musical interaction can be made more accessible by removing the need for prior training. Instead of using traditional instruments or notation, the system uses webcam-based body tracking as the main interface.

Users interact with four sound zones on the screen. As they move their hands into these zones, the music continues. When they stop moving, the music gradually fades. In this way, the system turns music into something that must be actively maintained through physical presence.

## Features

- 🎵 Four independent sound zones (sine, triangle, square, sawtooth)
- 🖐 Hand tracking using ml5.js (handPose)
- 🧍 Body tracking using MoveNet (bodyPose)
- 🙂 Face tracking (mouth detection triggers visual/audio effects)
- 🎮 Prompt-based interaction system (game layer)
- 🏆 Scoring system (prompt completion + target collection)
- 🔁 Generative music system (rule-based variation)

## Interaction

- Move your hands into zones to keep the music alive
- Stay still → sound fades out
- Follow prompts (e.g. "Left Hand", "Right Ear")
- Open your mouth to trigger additional effects
- Collect targets to increase your score

## Tech Stack

- p5.js
- ml5.js (handPose, bodyPose, faceMesh)
- Magenta.js (initial design, not used in final version)

## Notes on Generative System

The original design planned to use Magenta’s MusicRNN to generate evolving musical sequences. However, due to compatibility issues with the Magenta JS library, the final implementation uses a rule-based generator instead.

This generator:
- starts from predefined pentatonic patterns  
- randomly rotates loop positions  
- applies pitch variation (±1 pentatonic step)  
- applies rhythmic variation (note repetition)  

While not data-driven, it still produces continuous variation while keeping the music coherent.

## Future Work

- Reintroduce AI-based generation using Python + Magenta
- Add multiplayer interaction
- Separate game mode and exploration mode
- Improve tracking robustness

## Demo

coming...

## Author

Helga Tong  
Original Project for WN26 PAT 464: Gen AI for Music and Audio Creation
University of Michigan SMTD
