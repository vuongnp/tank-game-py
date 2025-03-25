from flask import Flask, render_template, jsonify, request
import json
import os
import math
import time
import random

app = Flask(__name__)

# Game state
game_state = {
    "tanks": [
        {
            "id": 1,
            "x": 100,
            "y": 100,
            "angle": 0,
            "health": 200,
            "color": "green",
            "barrels": 1,
        },
        {
            "id": 2,
            "x": 700,
            "y": 500,
            "angle": 180,
            "health": 100,
            "color": "blue",
            "barrels": 1,
        },
    ],
    "projectiles": [],
    "rewards": [],
    "gameActive": False,
    "mapWidth": 800,
    "mapHeight": 600,
    "lastUpdate": time.time(),
    "lastRewardSpawn": time.time(),
    "lastAIUpdate": time.time(),
    "lastAIShot": time.time(),
    "aiState": "patrol",  # patrol, pursue, attack
    "currentLevel": 1,
    "enemiesDefeated": 0,
    "enemiesRequired": 1,  # Number of enemies to defeat for level 1
    "maxEnemies": 1,  # Maximum enemies on screen at once for level 1
    "nextEnemySpawn": 0,  # Time when next enemy should spawn
}

# Reward types - Increased base barrel duration from 30 to 45 seconds
REWARD_TYPES = [
    {
        "type": "barrel",
        "color": "purple",
        "duration": 45,
        "radius": 15,
        "stackable": True,
    },
    {
        "type": "health",
        "color": "red",
        "duration": 0,
        "radius": 15,
        "stackable": False,
    },  # Health pack is instant
    # New reward type: Double damage
    {
        "type": "damage",
        "color": "orange",
        "duration": 30,
        "radius": 15,
        "stackable": True,
    },
]

# Enemy colors for different levels
ENEMY_COLORS = ["blue", "red", "darkviolet", "darkgoldenrod", "darkcyan"]

# Level configuration
LEVEL_CONFIG = {
    1: {"enemies_required": 1, "max_enemies": 1, "spawn_delay": 0, "ai_skill": 0.5},
    2: {"enemies_required": 3, "max_enemies": 1, "spawn_delay": 5, "ai_skill": 0.6},
    3: {"enemies_required": 5, "max_enemies": 2, "spawn_delay": 4, "ai_skill": 0.7},
    4: {"enemies_required": 8, "max_enemies": 2, "spawn_delay": 3, "ai_skill": 0.8},
    5: {"enemies_required": 12, "max_enemies": 3, "spawn_delay": 2, "ai_skill": 0.9},
}


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/game-state")
def get_game_state():
    # Update projectiles and check for reward spawning on each state request
    current_time = time.time()
    elapsed = current_time - game_state["lastUpdate"]

    if game_state["gameActive"]:
        update_projectiles(elapsed)
        check_reward_spawn(current_time)
        update_ai(current_time)
        check_enemy_spawn(current_time)
        game_state["lastUpdate"] = current_time

    return jsonify(game_state)


def check_enemy_spawn(current_time):
    # Only proceed if we're supposed to spawn a new enemy
    if current_time < game_state["nextEnemySpawn"]:
        return

    # Count current active AI tanks
    active_enemies = 0
    for tank in game_state["tanks"]:
        if tank["id"] != 1 and tank["health"] > 0:
            active_enemies += 1

    # Get configuration for current level
    level_conf = LEVEL_CONFIG.get(game_state["currentLevel"], LEVEL_CONFIG[5])

    # If we have fewer enemies than the maximum allowed, spawn a new one
    if active_enemies < level_conf["max_enemies"]:
        # Find the highest ID currently in use
        max_id = 1
        for tank in game_state["tanks"]:
            if tank["id"] > max_id:
                max_id = tank["id"]

        # Create new enemy with next ID
        new_id = max_id + 1

        # Pick a spawn position away from player
        player_tank = None
        for tank in game_state["tanks"]:
            if tank["id"] == 1:
                player_tank = tank
                break

        if player_tank:
            # Try to spawn away from the player
            spawn_x, spawn_y = get_spawn_position(player_tank)

            # Get color based on level (cycling through available colors)
            color_index = (game_state["currentLevel"] - 1) % len(ENEMY_COLORS)
            enemy_color = ENEMY_COLORS[color_index]

            # New enemy tank
            enemy_tank = {
                "id": new_id,
                "x": spawn_x,
                "y": spawn_y,
                "angle": random.randint(0, 359),
                "health": 80
                + (game_state["currentLevel"] * 10),  # Health increases with level
                "color": enemy_color,
                "barrels": 1,
                "ai_skill": level_conf["ai_skill"],  # Higher levels have smarter AI
            }

            game_state["tanks"].append(enemy_tank)

            # Set next spawn time based on level configuration
            game_state["nextEnemySpawn"] = current_time + level_conf["spawn_delay"]


def get_spawn_position(player_tank):
    """Get a spawn position for a new enemy, away from the player."""
    map_width = game_state["mapWidth"]
    map_height = game_state["mapHeight"]

    # Try to find a position that's at least 300 pixels away from the player
    for _ in range(10):  # Try 10 times
        # Pick a quadrant opposite to the player
        if player_tank["x"] < map_width / 2:
            spawn_x = random.randint(int(map_width * 0.6), int(map_width * 0.9))
        else:
            spawn_x = random.randint(int(map_width * 0.1), int(map_width * 0.4))

        if player_tank["y"] < map_height / 2:
            spawn_y = random.randint(int(map_height * 0.6), int(map_height * 0.9))
        else:
            spawn_y = random.randint(int(map_height * 0.1), int(map_height * 0.4))

        # Check distance to player
        dx = player_tank["x"] - spawn_x
        dy = player_tank["y"] - spawn_y
        distance = math.sqrt(dx * dx + dy * dy)

        if distance > 300:
            return spawn_x, spawn_y

    # If we couldn't find a good spot, return a random position
    return random.randint(50, map_width - 50), random.randint(50, map_height - 50)


def update_ai(current_time):
    # Update all AI tanks
    player_tank = None

    # First, find the player tank
    for tank in game_state["tanks"]:
        if tank["id"] == 1:
            player_tank = tank
            break

    if not player_tank or player_tank["health"] <= 0:
        return  # Player is dead, no need to update AI

    # Update each AI tank
    for ai_tank in game_state["tanks"]:
        if (
            ai_tank["id"] != 1 and ai_tank["health"] > 0
        ):  # Skip player tank and dead tanks
            update_ai_tank(ai_tank, player_tank, current_time)


def update_ai_tank(ai_tank, player_tank, current_time):
    # Calculate distance to player
    dx = player_tank["x"] - ai_tank["x"]
    dy = player_tank["y"] - ai_tank["y"]
    distance_to_player = math.sqrt(dx * dx + dy * dy)

    # Calculate angle to player
    angle_to_player = math.degrees(math.atan2(dx, -dy)) % 360

    # AI skill factor (higher levels have smarter AI)
    ai_skill = ai_tank.get("ai_skill", 0.5)

    # Update AI state based on distance to player
    if distance_to_player > 300:
        ai_state = "patrol"
    elif distance_to_player > 150:
        ai_state = "pursue"
    else:
        ai_state = "attack"

    # Perform actions based on AI state
    if ai_state == "patrol":
        # In patrol mode, move randomly and look for rewards
        if current_time - ai_tank.get("lastUpdate", 0) > 1.0:
            # Every second, potentially change direction
            if (
                random.random() < 0.7 * ai_skill
            ):  # Higher skill means better at finding rewards
                # Check if there are any rewards to move toward
                closest_reward = None
                min_distance = float("inf")

                for reward in game_state["rewards"]:
                    rx = reward["x"] - ai_tank["x"]
                    ry = reward["y"] - ai_tank["y"]
                    distance = math.sqrt(rx * rx + ry * ry)
                    if distance < min_distance:
                        min_distance = distance
                        closest_reward = reward

                if closest_reward:
                    # Calculate angle to reward
                    rx = closest_reward["x"] - ai_tank["x"]
                    ry = closest_reward["y"] - ai_tank["y"]
                    angle_to_reward = math.degrees(math.atan2(rx, -ry)) % 360

                    # Rotate toward reward
                    rotate_tank_to_angle(ai_tank, angle_to_reward)
                    # Move forward toward reward
                    move_tank_forward(ai_tank)

                    # If close to reward, try to collect it
                    if min_distance < 50:
                        check_reward_collision(ai_tank)
                else:
                    # No reward found, move randomly
                    ai_tank["angle"] = (
                        ai_tank["angle"] + random.randint(-30, 30)
                    ) % 360
                    move_tank_forward(ai_tank)
            else:
                # Random movement
                ai_tank["angle"] = (ai_tank["angle"] + random.randint(-30, 30)) % 360
                move_tank_forward(ai_tank)

            ai_tank["lastUpdate"] = current_time

    elif ai_state == "pursue":
        # In pursue mode, move toward player but keep some distance
        rotate_tank_to_angle(ai_tank, angle_to_player)

        # Decide whether to move forward or backward to maintain distance
        if distance_to_player > 250:
            move_tank_forward(ai_tank)
        elif distance_to_player < 200:
            move_tank_backward(ai_tank)

        # Occasionally fire at player
        if current_time - ai_tank.get("lastShot", 0) > (
            1.5 - (ai_skill * 0.5)
        ):  # Higher skill = faster firing
            if (
                abs(ai_tank["angle"] - angle_to_player) < (20 - (ai_skill * 10))
                and random.random() < ai_skill
            ):
                fire_tank_weapon(ai_tank)
                ai_tank["lastShot"] = current_time

    elif ai_state == "attack":
        # In attack mode, aim and fire at player
        rotate_tank_to_angle(ai_tank, angle_to_player)

        # Keep optimal distance from player
        if distance_to_player > 180:
            move_tank_forward(ai_tank)
        elif distance_to_player < 120:
            move_tank_backward(ai_tank)

        # If aimed at player, fire
        if abs((ai_tank["angle"] - angle_to_player + 180) % 360 - 180) < (
            15 - (ai_skill * 5)
        ):  # Higher skill = better aim
            if current_time - ai_tank.get("lastShot", 0) > (
                1.0 - (ai_skill * 0.3)
            ):  # Higher skill = faster firing
                fire_tank_weapon(ai_tank)
                ai_tank["lastShot"] = current_time

            # Also consider strafing to avoid being hit
            if random.random() < (
                0.3 + (ai_skill * 0.2)
            ):  # Higher skill = more evasive
                if random.random() < 0.5:
                    move_tank_left(ai_tank)
                else:
                    move_tank_right(ai_tank)


def rotate_tank_to_angle(tank, target_angle):
    # Calculate the shortest rotation direction
    current = tank["angle"]
    target = target_angle

    # Find the shortest angle difference
    angle_diff = ((target - current + 180) % 360) - 180

    # Apply a limited rotation (5 degrees per update)
    if abs(angle_diff) > 5:
        if angle_diff > 0:
            tank["angle"] = (tank["angle"] + 5) % 360
        else:
            tank["angle"] = (tank["angle"] - 5) % 360
    else:
        tank["angle"] = target_angle


def move_tank_forward(tank):
    speed = 5
    rad_angle = math.radians(tank["angle"])
    tank["x"] += math.sin(rad_angle) * speed
    tank["y"] -= math.cos(rad_angle) * speed
    keep_tank_in_bounds(tank)


def move_tank_backward(tank):
    speed = 5
    rad_angle = math.radians(tank["angle"])
    tank["x"] -= math.sin(rad_angle) * speed
    tank["y"] += math.cos(rad_angle) * speed
    keep_tank_in_bounds(tank)


def move_tank_left(tank):
    speed = 5
    rad_angle = math.radians(tank["angle"] - 90)
    tank["x"] += math.sin(rad_angle) * speed
    tank["y"] -= math.cos(rad_angle) * speed
    keep_tank_in_bounds(tank)


def move_tank_right(tank):
    speed = 5
    rad_angle = math.radians(tank["angle"] + 90)
    tank["x"] += math.sin(rad_angle) * speed
    tank["y"] -= math.cos(rad_angle) * speed
    keep_tank_in_bounds(tank)


def keep_tank_in_bounds(tank):
    # Keep tank within boundaries
    map_width = game_state["mapWidth"]
    map_height = game_state["mapHeight"]
    tank["x"] = max(20, min(tank["x"], map_width - 20))
    tank["y"] = max(20, min(tank["y"], map_height - 20))
    check_reward_collision(tank)


# Update the fire_tank_weapon function to apply damage boost


def fire_tank_weapon(tank):
    # Create a projectile for each barrel
    barrels = tank.get("barrels", 1)

    # Calculate damage - apply damage boost if active
    base_damage = 20
    damage_multiplier = tank.get("damageBoost", 1.0)
    projectile_damage = base_damage * damage_multiplier

    for i in range(barrels):
        # Calculate angle adjustment for multiple barrels
        angle_adjustment = 0
        if barrels > 1:
            # Spread from -15 to +15 degrees
            angle_adjustment = (i / (barrels - 1) * 30) - 15

        # Create a new projectile from the front of the tank
        fire_angle = tank["angle"] + angle_adjustment
        rad_angle = math.radians(fire_angle)

        # Position the projectile at the end of the cannon
        cannon_length = 30
        front_x = tank["x"] + math.sin(rad_angle) * cannon_length
        front_y = tank["y"] - math.cos(rad_angle) * cannon_length

        # Calculate velocity components
        projectile_speed = 15
        velocity_x = math.sin(rad_angle) * projectile_speed
        velocity_y = -math.cos(rad_angle) * projectile_speed

        # Add visualization for boosted damage
        projectile_color = "yellow"
        if damage_multiplier > 1.0:
            projectile_color = "orange"  # Boosted projectiles have orange color

        projectile = {
            "x": front_x,
            "y": front_y,
            "angle": fire_angle,
            "owner": tank["id"],
            "velocity_x": velocity_x,
            "velocity_y": velocity_y,
            "damage": projectile_damage,
            "color": projectile_color,
            "timestamp": time.time(),
            "active": True,
        }
        game_state["projectiles"].append(projectile)


def check_reward_spawn(current_time):
    # Spawn rewards every 10-20 seconds, more frequently in higher levels
    spawn_interval = max(5, 20 - (game_state["currentLevel"] * 2))
    if current_time - game_state.get("lastRewardSpawn", 0) > random.uniform(
        spawn_interval / 2, spawn_interval
    ):
        spawn_reward()
        game_state["lastRewardSpawn"] = current_time

    # Update reward durations and remove expired rewards
    for reward in list(game_state["rewards"]):
        if (
            "spawnTime" in reward and current_time - reward["spawnTime"] > 15
        ):  # Rewards disappear after 15 seconds
            game_state["rewards"].remove(reward)

    # Process all tanks for power-up expiration
    for tank in game_state["tanks"]:
        # Check barrel power-up expiration
        if "powerupTime" in tank and current_time - tank["powerupTime"] > tank.get(
            "powerupDuration", 45
        ):
            tank["barrels"] = 1  # Reset to default number of barrels
            if "powerupMessage" in tank:
                tank["powerupMessage"] = "Extra Barrels Expired"
                # Remove after 2 seconds
                tank["messageExpiry"] = current_time + 2

            # Clear power-up data
            if "powerupType" in tank:
                del tank["powerupType"]
            if "powerupColor" in tank:
                del tank["powerupColor"]

        # Check damage boost expiration
        if "damageBoostTime" in tank and current_time - tank[
            "damageBoostTime"
        ] > tank.get("damageBoostDuration", 30):
            tank["damageBoost"] = 1.0  # Reset to normal damage
            if "powerupMessage" in tank:
                tank["powerupMessage"] = "Damage Boost Expired"
                # Remove after 2 seconds
                tank["messageExpiry"] = current_time + 2

            # Clear power-up data
            if "damageBoostColor" in tank:
                del tank["damageBoostColor"]

        # Remove expired messages
        if "messageExpiry" in tank and current_time > tank["messageExpiry"]:
            if "powerupMessage" in tank:
                del tank["powerupMessage"]
            if "messageExpiry" in tank:
                del tank["messageExpiry"]


@app.route("/api/update", methods=["POST"])
def update_game():
    data = request.json
    player_id = data.get("id")
    action = data.get("action")
    value = data.get("value")

    map_width = game_state["mapWidth"]
    map_height = game_state["mapHeight"]

    for tank in game_state["tanks"]:
        if tank["id"] == player_id and tank["health"] > 0:
            if action == "rotate":
                # Smooth rotation based on value
                tank["angle"] = (tank["angle"] + value) % 360
            elif action == "move":
                speed = 5  # Pixels per frame
                # Handle direction: forward, backward, left, right
                if value == "forward":
                    # Move in direction of tank angle (0 degrees now points up)
                    rad_angle = math.radians(tank["angle"])
                    tank["x"] += math.sin(rad_angle) * speed
                    tank["y"] -= math.cos(rad_angle) * speed
                elif value == "backward":
                    # Move opposite to the direction of tank angle
                    rad_angle = math.radians(tank["angle"])
                    tank["x"] -= math.sin(rad_angle) * speed
                    tank["y"] += math.cos(rad_angle) * speed
                elif value == "left":
                    # Move perpendicular to tank angle (left)
                    rad_angle = math.radians(tank["angle"] - 90)
                    tank["x"] += math.sin(rad_angle) * speed
                    tank["y"] -= math.cos(rad_angle) * speed
                elif value == "right":
                    # Move perpendicular to tank angle (right)
                    rad_angle = math.radians(tank["angle"] + 90)
                    tank["x"] += math.sin(rad_angle) * speed
                    tank["y"] -= math.cos(rad_angle) * speed

                # Keep tank within boundaries
                tank["x"] = max(20, min(tank["x"], map_width - 20))
                tank["y"] = max(20, min(tank["y"], map_height - 20))

                # Check for reward collision
                check_reward_collision(tank)

            elif action == "fire":
                # Prevent rapid fire (limit to one projectile per 0.5 seconds)
                can_fire = True
                for proj in game_state["projectiles"]:
                    if (
                        proj["owner"] == tank["id"]
                        and time.time() - proj.get("timestamp", 0) < 0.5
                    ):
                        can_fire = False
                        break

                if can_fire:
                    # Get the number of barrels this tank has
                    barrels = tank.get("barrels", 1)

                    # Calculate damage - apply damage boost if active
                    base_damage = 20
                    damage_multiplier = tank.get("damageBoost", 1.0)
                    projectile_damage = base_damage * damage_multiplier

                    # Create a projectile for each barrel
                    # If barrels > 1, spread them out in a fan pattern
                    for i in range(barrels):
                        # Calculate angle adjustment for multiple barrels
                        angle_adjustment = 0
                        if barrels > 1:
                            # Spread from -15 to +15 degrees
                            angle_adjustment = (i / (barrels - 1) * 30) - 15

                        # Create a new projectile from the front of the tank
                        fire_angle = tank["angle"] + angle_adjustment
                        rad_angle = math.radians(fire_angle)

                        # Position the projectile at the end of the cannon
                        cannon_length = 30
                        front_x = tank["x"] + math.sin(rad_angle) * cannon_length
                        front_y = tank["y"] - math.cos(rad_angle) * cannon_length

                        # Calculate velocity components
                        projectile_speed = 15
                        velocity_x = math.sin(rad_angle) * projectile_speed
                        velocity_y = -math.cos(rad_angle) * projectile_speed

                        # Add visualization for boosted damage
                        projectile_color = "yellow"
                        if damage_multiplier > 1.0:
                            projectile_color = (
                                "orange"  # Boosted projectiles have orange color
                            )

                        projectile = {
                            "x": front_x,
                            "y": front_y,
                            "angle": fire_angle,
                            "owner": tank["id"],
                            "velocity_x": velocity_x,
                            "velocity_y": velocity_y,
                            "damage": projectile_damage,
                            "color": projectile_color,
                            "timestamp": time.time(),
                            "active": True,
                        }
                        game_state["projectiles"].append(projectile)

    return jsonify({"status": "success"})


# Update the check_reward_collision function for stacking and level scaling


def check_reward_collision(tank):
    # Check if tank has collided with any rewards
    for reward in list(game_state["rewards"]):
        dx = tank["x"] - reward["x"]
        dy = tank["y"] - reward["y"]
        distance = math.sqrt(dx * dx + dy * dy)

        if distance < (20 + reward["radius"]):  # Tank radius + reward radius
            # Apply reward effect
            if reward["type"] == "barrel":
                # Set maximum barrels (increase with level)
                max_barrels = min(3 + math.floor(game_state["currentLevel"] / 2), 6)

                # Increase barrel count
                tank["barrels"] = min(tank.get("barrels", 1) + 1, max_barrels)

                # Apply level scaling to duration - higher levels get longer duration
                base_duration = reward["duration"]
                level_bonus = (
                    game_state["currentLevel"] - 1
                ) * 5  # +5 seconds per level
                total_duration = base_duration + level_bonus

                # Check if we already have an active power-up
                if "powerupTime" in tank and "powerupDuration" in tank:
                    # Calculate remaining time on current power-up
                    current_time = time.time()
                    elapsed = current_time - tank["powerupTime"]
                    remaining = max(0, tank["powerupDuration"] - elapsed)

                    # Stack duration - add new duration to remaining time (if stackable)
                    if reward.get("stackable", False):
                        tank["powerupDuration"] = remaining + total_duration
                        tank["powerupTime"] = current_time
                    else:
                        # Take the longer of the two durations
                        if total_duration > remaining:
                            tank["powerupDuration"] = total_duration
                            tank["powerupTime"] = current_time
                else:
                    # New power-up
                    tank["powerupTime"] = time.time()
                    tank["powerupDuration"] = total_duration

                # Add visualization data
                tank["powerupType"] = reward["type"]
                tank["powerupColor"] = reward["color"]

                # Send notification to client
                tank["powerupMessage"] = (
                    f"Extra Barrels: {tank['barrels']} ({int(tank['powerupDuration'])}s)"
                )

            elif reward["type"] == "health":
                # Health pack gives more health in higher levels
                base_health = 30
                level_bonus = (
                    game_state["currentLevel"] - 1
                ) * 5  # +5 health per level
                health_gain = min(base_health + level_bonus, 50)  # Cap at +50 health

                tank["health"] = min(
                    tank.get("health", 0) + health_gain, 100
                )  # Max 100 health

                # Notification message
                tank["powerupMessage"] = f"Health Restored: +{health_gain}"

            elif reward["type"] == "damage":
                # New reward: increased damage
                tank["damageBoost"] = 2.0  # Double damage

                # Apply level scaling to duration
                base_duration = reward["duration"]
                level_bonus = (
                    game_state["currentLevel"] - 1
                ) * 3  # +3 seconds per level
                total_duration = base_duration + level_bonus

                # Handle stacking similar to barrel power-up
                if "damageBoostTime" in tank and "damageBoostDuration" in tank:
                    current_time = time.time()
                    elapsed = current_time - tank["damageBoostTime"]
                    remaining = max(0, tank["damageBoostDuration"] - elapsed)

                    if reward.get("stackable", False):
                        tank["damageBoostDuration"] = remaining + total_duration
                        tank["damageBoostTime"] = current_time
                    else:
                        if total_duration > remaining:
                            tank["damageBoostDuration"] = total_duration
                            tank["damageBoostTime"] = current_time
                else:
                    tank["damageBoostTime"] = time.time()
                    tank["damageBoostDuration"] = total_duration

                # Add visualization data
                tank["damageBoostColor"] = reward["color"]

                # Notification message
                tank["powerupMessage"] = (
                    f"Damage Boost: x2 ({int(tank['damageBoostDuration'])}s)"
                )

            # Remove the reward
            game_state["rewards"].remove(reward)
            break


def update_projectiles(elapsed=0.033):  # Default to ~30 FPS
    # Only process if game is active
    if not game_state["gameActive"]:
        return

    # Move all projectiles
    new_projectiles = []
    map_width = game_state["mapWidth"]
    map_height = game_state["mapHeight"]

    for projectile in game_state["projectiles"]:
        if not projectile.get("active", True):
            continue

        # Move projectile according to velocity and elapsed time
        projectile["x"] += projectile["velocity_x"] * elapsed * 30
        projectile["y"] += projectile["velocity_y"] * elapsed * 30

        # Check if projectile is still on the map
        if 0 <= projectile["x"] <= map_width and 0 <= projectile["y"] <= map_height:

            # Check for collisions with tanks
            hit = False
            for tank in game_state["tanks"]:
                # Skip the owner's tank or tanks with 0 health
                if tank["id"] == projectile["owner"] or tank["health"] <= 0:
                    continue

                # Collision detection
                dx = tank["x"] - projectile["x"]
                dy = tank["y"] - projectile["y"]
                distance = math.sqrt(dx * dx + dy * dy)

                if distance < 25:  # Approximate tank radius for collision
                    hit = True
                    tank["health"] -= projectile["damage"]

                    # Check if tank is destroyed
                    if tank["health"] <= 0:
                        tank["health"] = 0

                        # If an enemy is killed by player, update enemy counter
                        if tank["id"] != 1 and projectile["owner"] == 1:
                            game_state["enemiesDefeated"] += 1
                            check_level_completion()

                        # Check for game over if player is destroyed
                        if tank["id"] == 1:
                            check_game_over()

                    # Deactivate the projectile
                    projectile["active"] = False
                    break

            # Keep the projectile if it's still active and hasn't hit anything
            if not hit and projectile.get("active", True):
                new_projectiles.append(projectile)

        # Remove projectiles that go off-screen
        else:
            projectile["active"] = False

    game_state["projectiles"] = new_projectiles


def check_level_completion():
    # Check if player has defeated enough enemies to advance to next level
    level_conf = LEVEL_CONFIG.get(game_state["currentLevel"], LEVEL_CONFIG[5])

    if game_state["enemiesDefeated"] >= level_conf["enemies_required"]:
        # Level completed
        next_level = game_state["currentLevel"] + 1

        # Check if this was the final level
        if next_level > max(LEVEL_CONFIG.keys()):
            # Player completed all levels
            game_state["gameActive"] = False
            game_state["gameOver"] = True
            game_state["winner"] = 1  # Player wins
            game_state["completed"] = (
                True  # Indicates game was completed rather than lost
            )
        else:
            # Advance to next level
            game_state["currentLevel"] = next_level
            game_state["enemiesDefeated"] = 0  # Reset enemy counter

            # Configure for new level
            new_conf = LEVEL_CONFIG.get(next_level, LEVEL_CONFIG[5])
            game_state["enemiesRequired"] = new_conf["enemies_required"]
            game_state["maxEnemies"] = new_conf["max_enemies"]

            # Add a health bonus for completing a level
            for tank in game_state["tanks"]:
                if tank["id"] == 1:  # Player tank
                    tank["health"] = min(
                        tank["health"] + 20, 100
                    )  # Bonus health, max 100

            # Remove all enemies and spawn new ones for next level
            game_state["tanks"] = [
                tank for tank in game_state["tanks"] if tank["id"] == 1
            ]
            game_state["nextEnemySpawn"] = time.time()  # Spawn first enemy immediately


def check_game_over():
    # Check if player is alive
    player_alive = False

    for tank in game_state["tanks"]:
        if tank["id"] == 1 and tank["health"] > 0:
            player_alive = True
            break

    # If player is eliminated, declare game over
    if not player_alive:
        game_state["gameActive"] = False
        game_state["gameOver"] = True
        game_state["winner"] = 0  # AI wins (no specific enemy)


@app.route("/api/start-game", methods=["POST"])
def start_game():
    global game_state
    # Reset game state
    game_state = {
        "tanks": [
            {
                "id": 1,
                "x": 100,
                "y": 100,
                "angle": 0,
                "health": 100,
                "color": "green",
                "barrels": 1,
            }
        ],
        "projectiles": [],
        "rewards": [],
        "gameActive": True,
        "gameOver": False,
        "winner": None,
        "mapWidth": 800,
        "mapHeight": 600,
        "lastUpdate": time.time(),
        "lastRewardSpawn": time.time(),
        "lastAIUpdate": time.time(),
        "currentLevel": 1,
        "enemiesDefeated": 0,
        "enemiesRequired": LEVEL_CONFIG[1]["enemies_required"],
        "maxEnemies": LEVEL_CONFIG[1]["max_enemies"],
        "nextEnemySpawn": time.time(),  # Spawn first enemy immediately
    }

    # Spawn initial rewards
    for _ in range(2):
        spawn_reward()

    return jsonify({"status": "Game started"})


@app.route("/api/stop-game", methods=["POST"])
def stop_game():
    global game_state
    game_state["gameActive"] = False
    return jsonify({"status": "Game stopped"})


@app.route("/favicon.ico")
def favicon():
    return app.send_static_file("favicon.ico")


# Update the spawn_reward function to include the new reward type


def spawn_reward():
    # Don't spawn too many rewards
    max_rewards = 2 + game_state["currentLevel"]  # More rewards in higher levels
    if len(game_state["rewards"]) >= max_rewards:
        return

    # Choose a random reward type based on weighted probabilities
    roll = random.random()

    # Health more common in higher levels
    health_chance = 0.2 * game_state["currentLevel"]

    # Damage boost more rare, but increases with level
    damage_chance = 0.1 + (0.05 * game_state["currentLevel"])

    if roll < health_chance:
        reward_type = REWARD_TYPES[1]  # Health
    elif roll < health_chance + damage_chance:
        reward_type = REWARD_TYPES[2]  # Damage boost
    else:
        reward_type = REWARD_TYPES[0]  # Barrel

    # Choose a random position away from tanks
    valid_position = False
    attempts = 0
    x, y = 0, 0

    while not valid_position and attempts < 10:
        x = random.randint(50, game_state["mapWidth"] - 50)
        y = random.randint(50, game_state["mapHeight"] - 50)

        # Check if position is away from tanks
        valid_position = True
        for tank in game_state["tanks"]:
            dx = tank["x"] - x
            dy = tank["y"] - y
            distance = math.sqrt(dx * dx + dy * dy)
            if distance < 100:  # Keep rewards away from tanks
                valid_position = False
                break

        attempts += 1

    if valid_position:
        reward = {
            "type": reward_type["type"],
            "x": x,
            "y": y,
            "color": reward_type["color"],
            "radius": reward_type["radius"],
            "duration": reward_type["duration"],
            "stackable": reward_type.get("stackable", False),
            "spawnTime": time.time(),
        }
        game_state["rewards"].append(reward)


if __name__ == "__main__":
    app.run(debug=True)
