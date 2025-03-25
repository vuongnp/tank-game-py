import pygame
import sys
from tank import Tank
from projectile import Projectile
from level import Level
from utils import check_collision

# Initialize Pygame
pygame.init()

# Game settings
WIDTH, HEIGHT = 800, 600
FPS = 60

# Create the game window
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Tank Game")

# Initialize game variables
clock = pygame.time.Clock()
level = Level()
player_tank = Tank(position=(100, 100))
projectiles = []
game_over = False

def game_loop():
    global game_over

    while not game_over:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                game_over = True

            # Handle tank movement and shooting
            if event.type == pygame.KEYDOWN:
                if event.key == pygame.K_SPACE:
                    projectile = player_tank.shoot()
                    if projectile:
                        projectiles.append(projectile)

        # Update game state
        player_tank.update()
        for projectile in projectiles:
            projectile.update()
            if check_collision(projectile, level):
                projectiles.remove(projectile)

        # Draw everything
        screen.fill((0, 0, 0))  # Clear the screen
        level.draw(screen)
        player_tank.draw(screen)
        for projectile in projectiles:
            projectile.draw(screen)

        pygame.display.flip()  # Update the display
        clock.tick(FPS)  # Maintain the frame rate

    pygame.quit()
    sys.exit()

if __name__ == "__main__":
    game_loop()