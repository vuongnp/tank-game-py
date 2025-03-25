def check_collision(rect1, rect2):
    return (rect1.x < rect2.x + rect2.width and
            rect1.x + rect1.width > rect2.x and
            rect1.y < rect2.y + rect2.height and
            rect1.y + rect1.height > rect2.y)

def random_position(width, height):
    import random
    return random.randint(0, width), random.randint(0, height)

def load_level_data(file_path):
    import json
    with open(file_path, 'r') as file:
        return json.load(file)