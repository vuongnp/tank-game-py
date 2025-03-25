class Tank:
    def __init__(self, x, y, health=100):
        self.x = x
        self.y = y
        self.health = health
        self.alive = True

    def move(self, dx, dy):
        self.x += dx
        self.y += dy

    def shoot(self):
        return Projectile(self.x, self.y)

    def take_damage(self, damage):
        self.health -= damage
        if self.health <= 0:
            self.alive = False

class Projectile:
    def __init__(self, x, y, speed=5):
        self.x = x
        self.y = y
        self.speed = speed

    def update(self):
        self.y -= self.speed

    def check_collision(self, target):
        # Placeholder for collision detection logic
        pass