# Tank Game in Python

This project is a simple tank game implemented in Python that runs directly in the browser using Flask. The game allows players to control tanks, shoot projectiles, and navigate through different levels.

## Project Structure

```
tank-game-py
├── src
│   ├── game.py          # Main entry point for the game
│   ├── tank.py          # Defines the Tank class
│   ├── projectile.py     # Defines the Projectile class
│   ├── level.py         # Manages game levels
│   └── utils.py         # Utility functions
├── static
│   ├── js
│   │   └── client.js    # Client-side JavaScript
│   └── css
│       └── style.css     # Styles for the game interface
├── templates
│   └── index.html       # Main HTML template for the game
├── app.py               # Main application file
├── requirements.txt     # Project dependencies
└── README.md            # Project documentation
```

## Setup Instructions

1. **Clone the repository:**
   ```
   git clone https://github.com/yourusername/tank-game-py.git
   cd tank-game-py
   ```

2. **Install dependencies:**
   Make sure you have Python and pip installed. Then run:
   ```
   pip install -r requirements.txt
   ```

3. **Run the application:**
   ```
   python app.py
   ```

4. **Open your browser:**
   Navigate to `http://127.0.0.1:5000` to start playing the game.

## Gameplay

- Use the arrow keys to move your tank.
- Press the spacebar to shoot projectiles.
- Navigate through different levels and try to defeat your opponents.

## Contributing

Feel free to fork the repository and submit pull requests for any improvements or features you would like to add.

## License

This project is licensed under the MIT License. See the LICENSE file for details.