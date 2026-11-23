# Character Properties Survey

- **Source path:** `E:\SDroiModLegacy\SGenMod\Magic_Rampage_SGen_Final\npcs`
- **Files scanned:** 285
- **Files with at least one anomaly:** 266
- **Distinct properties found in `character` block:** 53

## Summary Table

| Property | Type | Files (active) | Files (commented only) | Distinct Values |
| :--- | :--- | :---: | :---: | :---: |
| [account](#account) | `string` | 1 | 0 | 1 |
| [accountDisplayName](#accountdisplayname) | `string` | 1 | 0 | 1 |
| [attackBehaviour](#attackbehaviour) | `string` | 282 | 1 | 3 |
| [attackCooldown](#attackcooldown) | `int` | 1 | 0 | 1 |
| [attackMinimumDistance](#attackminimumdistance) | `int` | 220 | 2 | 37 |
| [attackStyle](#attackstyle) | `string` | 77 | 14 | 11 |
| [bagSlots](#bagslots) | `int` | 285 | 0 | 6 |
| [bodyColor](#bodycolor) | `color/uint` | 233 | 18 | 46 |
| [bodyEntity](#bodyentity) | `file (.ent)` | 219 | 0 | 100 (file values omitted) |
| [bodySprite](#bodysprite) | `file (.png)` | 285 | 0 | 91 (file values omitted) |
| [childFileName](#childfilename) | `string` | 5 | 0 | 5 |
| [childType](#childtype) | `string` | 5 | 0 | 5 |
| [coins](#coins) | `int` | 1 | 0 | 1 |
| [confusedSound](#confusedsound) | `file (.mp3)` | 146 | 78 | 7 (file values omitted) |
| [damageSound](#damagesound) | `file (.mp3)` | 59 | 182 | 9 (file values omitted) |
| [dropEyes](#dropeyes) | `bool` | 156 | 0 | 2 |
| [enableAttackAnimation](#enableattackanimation) | `bool` | 25 | 0 | 2 |
| [enableDamageAnimation](#enabledamageanimation) | `bool` | 97 | 0 | 2 |
| [enableDustEffects](#enabledusteffects) | `bool` | 280 | 0 | 2 |
| [enableJumpEffects](#enablejumpeffects) | `bool` | 122 | 0 | 2 |
| [enableWalkDustEffects](#enablewalkdusteffects) | `bool` | 206 | 0 | 2 |
| [enableWalkOnWater](#enablewalkonwater) | `bool` | 53 | 4 | 2 |
| [exp](#exp) | `int` | 247 | 0 | 1 |
| [eyeColor](#eyecolor) | `color/uint` | 151 | 0 | 19 |
| [eyeSprite](#eyesprite) | `string` | 20 | 0 | 4 |
| [facts](#facts) | `string` | 39 | 1 | 20 |
| [feetEntity](#feetentity) | `file (.ent)` | 36 | 0 | 3 (file values omitted) |
| [feetSensorEntity](#feetsensorentity) | `file (.ent)` | 1 | 0 | 1 (file values omitted) |
| [fieldOfView](#fieldofview) | `int` | 284 | 0 | 12 |
| [gold](#gold) | `int` | 276 | 0 | 1 |
| [hairSprite](#hairsprite) | `string` | 285 | 0 | 35 |
| [idleTimeBeforeJump](#idletimebeforejump) | `int` | 285 | 0 | 23 |
| [jumpImpulse](#jumpimpulse) | `float` | 285 | 0 | 32 |
| [keepClassHelm](#keepclasshelm) | `bool` | 33 | 0 | 2 |
| [level](#level) | `int` | 284 | 0 | 1 |
| [name](#name) | `string` | 285 | 0 | 168 |
| [passiveDamage](#passivedamage) | `int` | 25 | 0 | 12 |
| [patrolBehaviour](#patrolbehaviour) | `string` | 283 | 0 | 1 |
| [playTime](#playtime) | `int` | 1 | 0 | 1 |
| [preciseAttack](#preciseattack) | `bool` | 220 | 6 | 2 |
| [progress](#progress) | `int` | 3 | 0 | 1 |
| [resistance](#resistance) | `int` | 285 | 0 | 79 |
| [runPendulum](#runpendulum) | `int` | 1 | 0 | 1 |
| [scale](#scale) | `float` | 207 | 9 | 24 |
| [seriousDamageWaitTime](#seriousdamagewaittime) | `int` | 40 | 0 | 4 |
| [shootBelowChest](#shootbelowchest) | `bool` | 3 | 0 | 1 |
| [speed](#speed) | `float` | 282 | 0 | 37 |
| [threatDetectedSound](#threatdetectedsound) | `file (.mp3, .ogg)` | 176 | 52 | 11 (file values omitted) |
| [version](#version) | `float` | 3 | 0 | 2 |
| [walkDuringCooldown](#walkduringcooldown) | `bool` | 96 | 9 | 2 |
| [walkingDustStride](#walkingduststride) | `mixed (int, float)` | 23 | 0 | 7 |
| [walkStyle](#walkstyle) | `string` | 84 | 14 | 12 |
| [xp](#xp) | `int` | 1 | 0 | 1 |

---

## Property Details

### account

- **Type:** `string`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `no_account_set` | 1 |

### accountDisplayName

- **Type:** `string`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `no_account_set` | 1 |

### attackBehaviour

- **Type:** `string`
- **Active files:** 282 / 285
- **Commented-only files:** 1
- **Total distinct values:** 3
- **Distinct values (3):**

| Value | File Count |
| :--- | :---: |
| `stoneThrower` | 161 |
| `knifeThrower` | 118 |
| `knifeThrowerDodge` | 3 |

### attackCooldown

- **Type:** `int`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `100`, max = `100`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `100` | 1 |

### attackMinimumDistance

- **Type:** `int`
- **Active files:** 220 / 285
- **Commented-only files:** 2
- **Total distinct values:** 37
- **Range:** min = `0`, max = `2560`
- **Top 15 most frequent values (of 37 distinct):**

| Value | File Count |
| :--- | :---: |
| `200` | 38 |
| `300` | 29 |
| `400` | 16 |
| `190` | 15 |
| `256` | 11 |
| `192` | 10 |
| `420` | 10 |
| `64` | 9 |
| `720` | 9 |
| `768` | 7 |
| `2560` | 6 |
| `260` | 6 |
| `500` | 6 |
| `110` | 5 |
| `150` | 5 |

### attackStyle

- **Type:** `string`
- **Active files:** 77 / 285
- **Commented-only files:** 14
- **Total distinct values:** 11
- **Distinct values (11):**

| Value | File Count |
| :--- | :---: |
| `zombie` | 33 |
| `spider` | 22 |
| `orc` | 4 |
| `spidemon` | 4 |
| `beholder` | 3 |
| `evilWarlock` | 3 |
| `demonStomper` | 2 |
| `fireLord` | 2 |
| `slime` | 2 |
| `golem` | 1 |
| `walker` | 1 |

### bagSlots

- **Type:** `int`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 6
- **Range:** min = `1`, max = `36`
- **Distinct values (6):**

| Value | File Count |
| :--- | :---: |
| `16` | 232 |
| `4` | 43 |
| `25` | 6 |
| `36` | 2 |
| `1` | 1 |
| `8` | 1 |

### bodyColor

- **Type:** `color/uint`
- **Active files:** 233 / 285
- **Commented-only files:** 18
- **Total distinct values:** 46
- **Range:** min = `0`, max = `4294967295`
- **Top 15 most frequent values (of 46 distinct):**

| Value | File Count |
| :--- | :---: |
| `16777215` | 62 |
| `4294967295` | 33 |
| `16774355` | 26 |
| `4289830521` | 11 |
| `0` | 7 |
| `11177075` | 7 |
| `16641930` | 6 |
| `4294496156` | 6 |
| `4294507519` | 6 |
| `16239960` | 5 |
| `4278190080` | 5 |
| `4289789884` | 4 |
| `4289789944` | 4 |
| `4292130427` | 4 |
| `16108724` | 3 |

### bodyEntity

- **Type:** `file (.ent)`
- **Active files:** 219 / 285
- **Commented-only files:** 0
- **Total distinct values:** 100
- **Values:** File values omitted (100 distinct file paths observed ending in .ent).

### bodySprite

- **Type:** `file (.png)`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 91
- **Values:** File values omitted (91 distinct file paths observed ending in .png).

### childFileName

- **Type:** `string`
- **Active files:** 5 / 285
- **Commented-only files:** 0
- **Total distinct values:** 5
- **Distinct values (5):**

| Value | File Count |
| :--- | :---: |
| `npcs/enemies/dark-ghost.character` | 1 |
| `npcs/enemies/spider-blood-blow.character` | 1 |
| `npcs/enemies/spider-blood-druid.character` | 1 |
| `npcs/enemies/tanker-helmet-matryoshka.character` | 1 |
| `npcs/enemies/tanker-rage-matryoshka.character` | 1 |

### childType

- **Type:** `string`
- **Active files:** 5 / 285
- **Commented-only files:** 0
- **Total distinct values:** 5
- **Distinct values (5):**

| Value | File Count |
| :--- | :---: |
| `blowing-jumper` | 1 |
| `default` | 1 |
| `ghost` | 1 |
| `jumper` | 1 |
| `rage` | 1 |

### coins

- **Type:** `int`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 1 |

### confusedSound

- **Type:** `file (.mp3)`
- **Active files:** 146 / 285
- **Commented-only files:** 78
- **Total distinct values:** 7
- **Values:** File values omitted (7 distinct file paths observed ending in .mp3).

### damageSound

- **Type:** `file (.mp3)`
- **Active files:** 59 / 285
- **Commented-only files:** 182
- **Total distinct values:** 9
- **Values:** File values omitted (9 distinct file paths observed ending in .mp3).

### dropEyes

- **Type:** `bool`
- **Active files:** 156 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `false` | 138 |
| `true` | 18 |

### enableAttackAnimation

- **Type:** `bool`
- **Active files:** 25 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 23 |
| `false` | 2 |

### enableDamageAnimation

- **Type:** `bool`
- **Active files:** 97 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `false` | 83 |
| `true` | 14 |

### enableDustEffects

- **Type:** `bool`
- **Active files:** 280 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 243 |
| `false` | 38 |

### enableJumpEffects

- **Type:** `bool`
- **Active files:** 122 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 62 |
| `false` | 61 |

### enableWalkDustEffects

- **Type:** `bool`
- **Active files:** 206 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 161 |
| `false` | 45 |

### enableWalkOnWater

- **Type:** `bool`
- **Active files:** 53 / 285
- **Commented-only files:** 4
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 38 |
| `false` | 15 |

### exp

- **Type:** `int`
- **Active files:** 247 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 247 |

### eyeColor

- **Type:** `color/uint`
- **Active files:** 151 / 285
- **Commented-only files:** 0
- **Total distinct values:** 19
- **Range:** min = `13565952`, max = `4294967295`
- **Distinct values (19):**

| Value | File Count |
| :--- | :---: |
| `13565952` | 44 |
| `4294901760` | 30 |
| `16711680` | 26 |
| `16514990` | 15 |
| `4294967295` | 9 |
| `4283751333` | 4 |
| `4294959616` | 4 |
| `3224019916` | 3 |
| `4284940236` | 3 |
| `16774355` | 2 |
| `4278247676` | 2 |
| `4287350080` | 2 |
| `4293759519` | 2 |
| `3294012216` | 1 |
| `4285328392` | 1 |
| `4294686720` | 1 |
| `4294705070` | 1 |
| `4294914816` | 1 |
| `4294962493` | 1 |

### eyeSprite

- **Type:** `string`
- **Active files:** 20 / 285
- **Commented-only files:** 0
- **Total distinct values:** 4
- **Distinct values (4):**

| Value | File Count |
| :--- | :---: |
| `kingsEyes` | 9 |
| `eyeVivi` | 6 |
| `eyeEvil` | 4 |
| `eyeFemaleA` | 1 |

### facts

- **Type:** `string`
- **Active files:** 39 / 285
- **Commented-only files:** 1
- **Total distinct values:** 20
- **Distinct values (20):**

| Value | File Count |
| :--- | :---: |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:true\;dodge-cooldown:1800` | 8 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:true\;dodge-cooldown:1500` | 5 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:false\;dodge-cooldown:1100` | 3 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:false\;dodge-cooldown:1500` | 3 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:false\;dodge-cooldown:3000` | 3 |
| `class-head-skin:priest13\;dodge-while-patrolling:true\;only-dodge-if-seeing-projectile:true\;dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:true\;dodge-cooldown:800` | 2 |
| `courage-lane-points:60\;force-lane-points:60\;wisdom-lane-points:60\;` | 2 |
| `blow-up-damage:200` | 1 |
| `charge-blast-offsetY:-44\;charge-blast-burst-effect-depth-offset:1\;` | 1 |
| `class-head-skin:druid17\;` | 1 |
| `class-head-skin:elite-warrior1` | 1 |
| `class-head-skin:elite-warrior2` | 1 |
| `class-head-skin:ranger1` | 1 |
| `class-head-skin:rogue14` | 1 |
| `class-head-skin:warlock19\;dodge-while-patrolling:true\;only-dodge-if-seeing-projectile:false\;dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:true\;dodge-cooldown:800` | 1 |
| `class-head-skin:warrior17` | 1 |
| `courage-lane-points:25\;` | 1 |
| `created-after-331:true\;hd-71331a87:true\;post-v760:true\;` | 1 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:false\;dodge-cooldown:2500` | 1 |
| `dodge-in-the-air:true\;max-dodges-in-a-row:0\;dodge-when-attacking:true\;dodge-when-running:true\;dodge-cooldown:1200` | 1 |

### feetEntity

- **Type:** `file (.ent)`
- **Active files:** 36 / 285
- **Commented-only files:** 0
- **Total distinct values:** 3
- **Values:** File values omitted (3 distinct file paths observed ending in .ent).

### feetSensorEntity

- **Type:** `file (.ent)`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Values:** File values omitted (1 distinct file paths observed ending in .ent).

### fieldOfView

- **Type:** `int`
- **Active files:** 284 / 285
- **Commented-only files:** 0
- **Total distinct values:** 12
- **Range:** min = `10`, max = `270`
- **Distinct values (12):**

| Value | File Count |
| :--- | :---: |
| `45` | 164 |
| `20` | 31 |
| `30` | 23 |
| `190` | 20 |
| `90` | 19 |
| `35` | 10 |
| `10` | 4 |
| `60` | 4 |
| `180` | 3 |
| `25` | 3 |
| `270` | 2 |
| `40` | 1 |

### gold

- **Type:** `int`
- **Active files:** 276 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 276 |

### hairSprite

- **Type:** `string`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 35
- **Top 15 most frequent values (of 35 distinct):**

| Value | File Count |
| :--- | :---: |
| `faceless` | 175 |
| `zombie1` | 10 |
| `tanker0` | 9 |
| `femaleCastleGuard0` | 8 |
| `castleGuard1` | 7 |
| `rat4` | 6 |
| `deco0` | 5 |
| `oldDad0` | 5 |
| `zombie0` | 5 |
| `castleSalesman0` | 4 |
| `dad0` | 4 |
| `helmet0` | 4 |
| `rat1` | 4 |
| `skeletonHelmet` | 4 |
| `dudeHendrix` | 3 |

### idleTimeBeforeJump

- **Type:** `int`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 23
- **Range:** min = `10`, max = `5000`
- **Distinct values (23):**

| Value | File Count |
| :--- | :---: |
| `200` | 87 |
| `150` | 41 |
| `1300` | 31 |
| `100` | 30 |
| `300` | 26 |
| `250` | 12 |
| `1500` | 11 |
| `700` | 10 |
| `500` | 9 |
| `2000` | 4 |
| `80` | 4 |
| `45` | 3 |
| `450` | 3 |
| `50` | 3 |
| `1000` | 2 |
| `400` | 2 |
| `70` | 2 |
| `800` | 2 |
| `10` | 1 |
| `1200` | 1 |
| `230` | 1 |
| `40` | 1 |
| `5000` | 1 |

### jumpImpulse

- **Type:** `float`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 32
- **Range:** min = `0`, max = `55`
- **Top 15 most frequent values (of 32 distinct):**

| Value | File Count |
| :--- | :---: |
| `31` | 35 |
| `35` | 32 |
| `33` | 25 |
| `28` | 20 |
| `30` | 20 |
| `32` | 17 |
| `24.5` | 16 |
| `25` | 15 |
| `1` | 12 |
| `29.5` | 12 |
| `36` | 12 |
| `38` | 10 |
| `37` | 7 |
| `16` | 6 |
| `0` | 5 |

### keepClassHelm

- **Type:** `bool`
- **Active files:** 33 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 27 |
| `false` | 6 |

### level

- **Type:** `int`
- **Active files:** 284 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `1`, max = `1`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `1` | 284 |

### name

- **Type:** `string`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 168
- **Top 15 most frequent values (of 168 distinct):**

| Value | File Count |
| :--- | :---: |
| `Dude Guard` | 10 |
| `Spider` | 10 |
| `Papa Hendrix` | 8 |
| `Guard Tanker` | 7 |
| `Armored Red Skeleton` | 6 |
| `Fire Skeleton` | 6 |
| `Ice Skeleton` | 5 |
| `Time Patroller` | 5 |
| `Demon Head` | 4 |
| `Female Castle Guard` | 4 |
| `Ape Demon` | 3 |
| `Armored Ape` | 3 |
| `Castle Salesman` | 3 |
| `Deco` | 3 |
| `Evil Warlock` | 3 |

### passiveDamage

- **Type:** `int`
- **Active files:** 25 / 285
- **Commented-only files:** 0
- **Total distinct values:** 12
- **Range:** min = `0`, max = `400`
- **Distinct values (12):**

| Value | File Count |
| :--- | :---: |
| `30` | 4 |
| `80` | 4 |
| `120` | 3 |
| `20` | 3 |
| `250` | 3 |
| `0` | 2 |
| `1` | 1 |
| `100` | 1 |
| `400` | 1 |
| `5` | 1 |
| `60` | 1 |
| `7` | 1 |

### patrolBehaviour

- **Type:** `string`
- **Active files:** 283 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `waypoints` | 283 |

### playTime

- **Type:** `int`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 1 |

### preciseAttack

- **Type:** `bool`
- **Active files:** 220 / 285
- **Commented-only files:** 6
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `true` | 149 |
| `false` | 71 |

### progress

- **Type:** `int`
- **Active files:** 3 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 3 |

### resistance

- **Type:** `int`
- **Active files:** 285 / 285
- **Commented-only files:** 0
- **Total distinct values:** 79
- **Range:** min = `3`, max = `999999999`
- **Top 15 most frequent values (of 79 distinct):**

| Value | File Count |
| :--- | :---: |
| `999999999` | 57 |
| `9999999` | 14 |
| `600` | 13 |
| `4000` | 10 |
| `1000` | 8 |
| `3000` | 8 |
| `180` | 7 |
| `3500` | 7 |
| `9000` | 7 |
| `40` | 6 |
| `5000` | 6 |
| `80` | 6 |
| `99999999` | 6 |
| `110` | 5 |
| `12000` | 5 |

### runPendulum

- **Type:** `int`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 1 |

### scale

- **Type:** `float`
- **Active files:** 207 / 285
- **Commented-only files:** 9
- **Total distinct values:** 24
- **Range:** min = `0.5`, max = `2`
- **Distinct values (24):**

| Value | File Count |
| :--- | :---: |
| `1.2` | 29 |
| `1.1` | 28 |
| `1.0` | 23 |
| `1.4` | 21 |
| `1` | 19 |
| `1.3` | 12 |
| `1.05` | 11 |
| `0.85` | 9 |
| `0.9` | 9 |
| `0.8` | 6 |
| `1.07` | 6 |
| `1.15` | 5 |
| `0.7` | 4 |
| `0.75` | 4 |
| `1.5` | 4 |
| `0.65` | 3 |
| `1.12` | 3 |
| `1.25` | 3 |
| `1.35` | 3 |
| `0.5` | 2 |
| `0.6` | 1 |
| `1.075` | 1 |
| `1.7` | 1 |
| `2` | 1 |

### seriousDamageWaitTime

- **Type:** `int`
- **Active files:** 40 / 285
- **Commented-only files:** 0
- **Total distinct values:** 4
- **Range:** min = `0`, max = `450`
- **Distinct values (4):**

| Value | File Count |
| :--- | :---: |
| `350` | 22 |
| `0` | 10 |
| `450` | 4 |
| `50` | 4 |

### shootBelowChest

- **Type:** `bool`
- **Active files:** 3 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `true` | 3 |

### speed

- **Type:** `float`
- **Active files:** 282 / 285
- **Commented-only files:** 0
- **Total distinct values:** 37
- **Range:** min = `2`, max = `15`
- **Top 15 most frequent values (of 37 distinct):**

| Value | File Count |
| :--- | :---: |
| `5.4` | 44 |
| `5` | 38 |
| `6` | 34 |
| `8` | 26 |
| `7` | 15 |
| `3` | 14 |
| `7.0` | 10 |
| `11` | 9 |
| `6.5` | 8 |
| `8.0` | 8 |
| `9` | 7 |
| `3.2` | 6 |
| `4` | 6 |
| `5.0` | 6 |
| `7.5` | 6 |

### threatDetectedSound

- **Type:** `file (.mp3, .ogg)`
- **Active files:** 176 / 285
- **Commented-only files:** 52
- **Total distinct values:** 11
- **Values:** File values omitted (11 distinct file paths observed ending in .mp3, .ogg).

### version

- **Type:** `float`
- **Active files:** 3 / 285
- **Commented-only files:** 0
- **Total distinct values:** 2
- **Range:** min = `1`, max = `2`
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `1.0` | 2 |
| `2.0` | 1 |

### walkDuringCooldown

- **Type:** `bool`
- **Active files:** 96 / 285
- **Commented-only files:** 9
- **Total distinct values:** 2
- **Distinct values (2):**

| Value | File Count |
| :--- | :---: |
| `false` | 52 |
| `true` | 44 |

### walkingDustStride

- **Type:** `mixed (int, float)`
- **Active files:** 23 / 285
- **Commented-only files:** 0
- **Total distinct values:** 7
- **Range:** min = `30`, max = `100`
- **Distinct values (7):**

| Value | File Count |
| :--- | :---: |
| `70` | 9 |
| `30` | 8 |
| `75` | 2 |
| `100` | 1 |
| `50` | 1 |
| `70.0f` | 1 |
| `80` | 1 |

### walkStyle

- **Type:** `string`
- **Active files:** 84 / 285
- **Commented-only files:** 14
- **Total distinct values:** 12
- **Distinct values (12):**

| Value | File Count |
| :--- | :---: |
| `zombie` | 33 |
| `spider` | 22 |
| `slow` | 7 |
| `orc` | 4 |
| `spidemon` | 4 |
| `beholder` | 3 |
| `evilWarlock` | 3 |
| `demonStomper` | 2 |
| `fireLord` | 2 |
| `slime` | 2 |
| `golem` | 1 |
| `walker` | 1 |

### xp

- **Type:** `int`
- **Active files:** 1 / 285
- **Commented-only files:** 0
- **Total distinct values:** 1
- **Range:** min = `0`, max = `0`
- **Distinct values (1):**

| Value | File Count |
| :--- | :---: |
| `0` | 1 |

---

## Anomalies

A total of **266** files exhibited at least one anomaly.

### 1. Repeated Active Keys Inside `character` Block (6 files)

The following files define the same property more than once inside the `character` block:

- **`allies/dark-twin.character`**:
  - Line 24: repeated active key 'attackMinimumDistance' inside character block (value: "500", prior value: "64")
  - Line 27: repeated active key 'enableJumpEffects' inside character block (value: "false", prior value: "true")
  - Line 28: repeated active key 'enableDustEffects' inside character block (value: "false", prior value: "true")
- **`bosses/final-king.character`**:
  - Line 18: repeated active key 'idleTimeBeforeJump' inside character block (value: "700", prior value: "150")
- **`bosses/king.character`**:
  - Line 18: repeated active key 'idleTimeBeforeJump' inside character block (value: "700", prior value: "150")
- **`enemies/xmas-duck.character`**:
  - Line 15: repeated active key 'scale' inside character block (value: "0.9", prior value: "0.5")
- **`enemies/xmas-skeleton-blue-mage.character`**:
  - Line 20: repeated active key 'eyeColor' inside character block (value: "4294967295", prior value: "3224019916")
- **`fighters/fighter3.character`**:
  - Line 18: repeated active key 'jumpImpulse' inside character block (value: "33", prior value: "31")

### 2. Missing Semicolons Inside `character` Block (4 files)

The following files contain property assignments lacking the terminating `;` delimiter:

- **`enemies/xmas-duck.character`**:
  - Line 8: line without ';' inside block 'character': "scale = 0.5"
- **`enemies/xmas-green-bear-small.character`**:
  - Line 8: line without ';' inside block 'character': "scale = 0.65"
- **`enemies/xmas-pink-bear-small.character`**:
  - Line 8: line without ';' inside block 'character': "scale = 0.65"
- **`enemies/xmas-purple-bear-small.character`**:
  - Line 7: line without ';' inside block 'character': "scale = 0.65"

### 3. Extra Top-Level Blocks (266 files)

The standard file format described in the brief expects only a top-level `character { ... }` block followed by `EOF____`. In **266** of 285 files, additional top-level blocks are present (such as `equippedItem0`, `equippedItem1`, `equippedItem2`, `unequippedItem1`, `unequippedItem2`, `item0`–`item6`, and `id`).

#### Breakdown by Block Signature

| Blocks Present | Number of Files | Sample Files |
| :--- | :---: | :--- |
| `equippedItem0, equippedItem1` | 126 | `allies/castle-guard-1.character`, `allies/castle-guard-2.character`, `allies/castle-salesman.character`, ... |
| `equippedItem0` | 102 | `allies/castle-guard.character`, `allies/dude-future-no-weapon.character`, `allies/moon-keeper-weaponless.character`, ... |
| `equippedItem0, equippedItem1, equippedItem2` | 20 | `allies/druid-spider.character`, `allies/dude-spider.character`, `allies/moon-keeper-b.character`, ... |
| `equippedItem0, equippedItem1, item0` | 3 | `bosses/cyclops.character`, `bosses/gorgon.character`, `bosses/orc-fighter.character` |
| `equippedItem1, equippedItem0` | 3 | `fighters/fighter1.character`, `fighters/fighter2.character`, `fighters/fighter3.character` |
| `equippedItem0, unequippedItem1` | 2 | `allies/dude-shadow-dungeon44.character`, `allies/papa-hendrix-shadow-dungeon44.character` |
| `equippedItem0, item0` | 2 | `bosses/blood-lord.character`, `bosses/fire-lord.character` |
| `equippedItem1` | 2 | `enemies/cthulhu-imp-WDG.character`, `enemies/cthulhu-imp.character` |
| `equippedItem0, equippedItem1, equippedItem2, item0, item1, item2, item3, item4, item5, item6` | 1 | `allies/dungeon44-ethereal-captain.character` |
| `equippedItem0, unequippedItem1, unequippedItem2` | 1 | `allies/moon-keeper-shadow-dungeon44.character` |
| `equippedItem0, item0, item1, item2` | 1 | `bosses/final-king.character` |
| `equippedItem0, equippedItem1, item0, item1` | 1 | `bosses/king.character` |
| `equippedItem0, id` | 1 | `dummy.character` |
| `equippedItem0, item1` | 1 | `enemies/xmas-jumping-green-bear.character` |

<details>
<summary>Click to expand full list of all 266 files with extra top-level blocks</summary>

- `allies/castle-guard-1.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/castle-guard-2.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/castle-guard.character`: Extra top-level block(s): equippedItem0
- `allies/castle-salesman.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/cat-keeper-tavern.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dark-twin.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/druid-spider.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `allies/dude-a.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-b-ghost.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-b.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-c.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-dungeon41.1.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-epic.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-future-43.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-future-no-weapon.character`: Extra top-level block(s): equippedItem0
- `allies/dude-future.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-hendrix.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/dude-shadow-dungeon44.character`: Extra top-level block(s): equippedItem0, unequippedItem1
- `allies/dude-spider.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `allies/dungeon44-ethereal-captain.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2, item0, item1, item2, item3, item4, item5, item6
- `allies/female-castle-guard-fire.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/female-castle-guard-witch.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/female-castle-guard-x.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/female-castle-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/king.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/kingptain-dungeon42-dream.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/kingptain.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/minion-duel-tutorial.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/minion.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/moon-keeper-b.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `allies/moon-keeper-chapter5.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `allies/moon-keeper-shadow-dungeon44.character`: Extra top-level block(s): equippedItem0, unequippedItem1, unequippedItem2
- `allies/moon-keeper-weaponless.character`: Extra top-level block(s): equippedItem0
- `allies/moon-keeper.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix-5-2.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix-chapter5-4.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix-chapter5.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix-dungeon44.character`: Extra top-level block(s): equippedItem0
- `allies/papa-hendrix-run-home.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix-shadow-dungeon44.character`: Extra top-level block(s): equippedItem0, unequippedItem1
- `allies/papa-hendrix-training-hall.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/papa-hendrix.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/scavenger-b.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/time-patroller-dungeon44.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/time-patroller-end-scene.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `allies/witchdoctor-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `allies/xmas-santas-minion.character`: Extra top-level block(s): equippedItem0
- `bosses/ape-demon.character`: Extra top-level block(s): equippedItem0
- `bosses/ape-junina.character`: Extra top-level block(s): equippedItem0
- `bosses/ape-santa.character`: Extra top-level block(s): equippedItem0
- `bosses/ape-skeleton.character`: Extra top-level block(s): equippedItem0
- `bosses/beholder-witch.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/beholder.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/blood-lord.character`: Extra top-level block(s): equippedItem0, item0
- `bosses/cangaceiro.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/chest-demon-gift.character`: Extra top-level block(s): equippedItem0
- `bosses/chest-demon.character`: Extra top-level block(s): equippedItem0
- `bosses/corrupted-stomper.character`: Extra top-level block(s): equippedItem0
- `bosses/cyclops.character`: Extra top-level block(s): equippedItem0, equippedItem1, item0
- `bosses/dark-spektator.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/demon-stomper.character`: Extra top-level block(s): equippedItem0
- `bosses/demonic-spider.character`: Extra top-level block(s): equippedItem0
- `bosses/evil-warlock.character`: Extra top-level block(s): equippedItem0
- `bosses/final-king.character`: Extra top-level block(s): equippedItem0, item0, item1, item2
- `bosses/final-warlock.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/fire-lord.character`: Extra top-level block(s): equippedItem0, item0
- `bosses/giant-demon-head.character`: Extra top-level block(s): equippedItem0
- `bosses/giant-spider.character`: Extra top-level block(s): equippedItem0
- `bosses/gigaspider.character`: Extra top-level block(s): equippedItem0
- `bosses/golem.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/gorgon.character`: Extra top-level block(s): equippedItem0, equippedItem1, item0
- `bosses/ice-golem.character`: Extra top-level block(s): equippedItem0
- `bosses/king.character`: Extra top-level block(s): equippedItem0, equippedItem1, item0, item1
- `bosses/orc-fighter.character`: Extra top-level block(s): equippedItem0, equippedItem1, item0
- `bosses/slime-demon.character`: Extra top-level block(s): equippedItem0
- `bosses/spidemon-higher-jump.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/spidemon.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/template.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/tombstone-mimic.character`: Extra top-level block(s): equippedItem0
- `bosses/vindicator-carnival.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/vindicator.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `bosses/vulkling.character`: Extra top-level block(s): equippedItem0
- `bosses/walker.character`: Extra top-level block(s): equippedItem0
- `bosses/xmas-mimic.character`: Extra top-level block(s): equippedItem0
- `dummy.character`: Extra top-level block(s): equippedItem0, id
- `enemies/_sdroimod-guard-tanker-elite-1.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/air-elemental.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/alien.character`: Extra top-level block(s): equippedItem0
- `enemies/armored-axe-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/armored-enraged-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/armored-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/beetle_anubis.character`: Extra top-level block(s): equippedItem0
- `enemies/beetle_anubis_red.character`: Extra top-level block(s): equippedItem0
- `enemies/blood-druid.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-elemental.character`: Extra top-level block(s): equippedItem0
- `enemies/blood-mini-warlock.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-priest.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-ranger-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-rogue.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-warrior-elite-zombie.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-warrior-zombie.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/blood-warrior.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/carcara.character`: Extra top-level block(s): equippedItem0
- `enemies/carnival-buffoon-green-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/carnival-buffoon-purple-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/carnival-bunny-mask-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/carnival-captain-mask-necromancer.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/carnival-captain-mask-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/carnival-pilot-mask-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/carnival-pumpkin-mask-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/carnival-rat-buffoon-green.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/carnival-rat-buffoon-purple.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/carnival-salesman-mask-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/cthulhu-imp-WDG.character`: Extra top-level block(s): equippedItem1
- `enemies/cthulhu-imp.character`: Extra top-level block(s): equippedItem1
- `enemies/dark-ghost.character`: Extra top-level block(s): equippedItem0
- `enemies/dark-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/dark-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/dark-tanker.character`: Extra top-level block(s): equippedItem0
- `enemies/demon-head-ice.character`: Extra top-level block(s): equippedItem0
- `enemies/demon-head.character`: Extra top-level block(s): equippedItem0
- `enemies/demonic-spider-blowing-minion.character`: Extra top-level block(s): equippedItem0
- `enemies/demonic-spider-minion.character`: Extra top-level block(s): equippedItem0
- `enemies/easter-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/evil-warlock.character`: Extra top-level block(s): equippedItem0
- `enemies/fire-bat-adult.character`: Extra top-level block(s): equippedItem0
- `enemies/fire-bat.character`: Extra top-level block(s): equippedItem0
- `enemies/fire-elemental.character`: Extra top-level block(s): equippedItem0
- `enemies/fire-skeleton-b.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/fire-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/fire-skeleton-master.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/fire-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ghost-rat.character`: Extra top-level block(s): equippedItem0
- `enemies/guard-tanker-a.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/guard-tanker-b.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/guard-tanker-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/harmless-tanker.character`: Extra top-level block(s): equippedItem0
- `enemies/helmet-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/ice-necromancer-WDG.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-necromancer.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton-WDG.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton-elite-WDG.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton-tanker-WDG.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton-tanker.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ice-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/ifrits-disciple.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/jumping-fire-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/jumping-fire-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/jumping-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/jumping-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/junina-skeleton-a.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-b.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-dark-shadow.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-fire.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-knife-guard.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-poison-thrower.character`: Extra top-level block(s): equippedItem0
- `enemies/junina-skeleton-shadow.character`: Extra top-level block(s): equippedItem0
- `enemies/kingptain-dungeon43.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/miniboss-gigaspider-critter.character`: Extra top-level block(s): equippedItem0
- `enemies/mummy-blue-cosmos.character`: Extra top-level block(s): equippedItem0
- `enemies/mummy-gold-cosmos.character`: Extra top-level block(s): equippedItem0
- `enemies/mummy.character`: Extra top-level block(s): equippedItem0
- `enemies/mush-vacuum-WDG.character`: Extra top-level block(s): equippedItem0
- `enemies/mush-vacuum.character`: Extra top-level block(s): equippedItem0
- `enemies/mushroom-spitter.character`: Extra top-level block(s): equippedItem0
- `enemies/my-character.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/nature-skeleton-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/nature-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/priest-minion.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/pumpkin-rat-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/pumpkin-skeleton-scythe.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/pumpkin-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/pumpkin-water-skeleton-scythe.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/pumpkin-water-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/pumpkin-zombie-rat.character`: Extra top-level block(s): equippedItem0
- `enemies/rat-black-mage.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-fighter.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-fire-mage.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-lancer.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-poison-thrower.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/rat-rogue-prisoner.character`: Extra top-level block(s): equippedItem0
- `enemies/rat-rogue.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-skeleton-hammer.character`: Extra top-level block(s): equippedItem0
- `enemies/rat-skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/rat-warrior.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-water-mage.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/rat-zombie-knife-guard-b.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/rat-zombie-knife-guard-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/rat-zombie-knife-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/shaman-fire-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/shaman-fire.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/shaman-nature-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/shaman-nature.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/skeleton-b.character`: Extra top-level block(s): equippedItem0
- `enemies/skeleton-fire-lava-witch.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/skeleton-fire-soldier-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/skeleton-fire-soldier.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/skeleton-fire.character`: Extra top-level block(s): equippedItem0
- `enemies/skeleton.character`: Extra top-level block(s): equippedItem0
- `enemies/snow-monster.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-b-weak.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-b.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-blood-blow.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-blood-druid.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-blow.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-boss.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-c.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-easter-green.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-easter-pink.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-easter.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-fire.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-gift.character`: Extra top-level block(s): equippedItem0
- `enemies/spider-swamp.character`: Extra top-level block(s): equippedItem0
- `enemies/spider.character`: Extra top-level block(s): equippedItem0
- `enemies/swamp-monster.character`: Extra top-level block(s): equippedItem0
- `enemies/tanker-elite-matryoshka.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/tanker-helmet-matryoshka.character`: Extra top-level block(s): equippedItem0
- `enemies/tanker-rage-matryoshka.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/time-patroller-dungeon40.1.character`: Extra top-level block(s): equippedItem0
- `enemies/time-patroller-dungeon40.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/time-patroller.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/vampire.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/void-skeleton.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/water-vampire.character`: Extra top-level block(s): equippedItem0, equippedItem1, equippedItem2
- `enemies/xmas-doll-blond.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-doll-brunette.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-duck.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-fire-bear-elite.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-fire-bear.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-gift-vacuum.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-green-bear-small.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-jumping-green-bear.character`: Extra top-level block(s): equippedItem0, item1
- `enemies/xmas-pink-bear-small.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-pink-bear.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-purple-bear-ez.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-purple-bear-small.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-purple-bear.character`: Extra top-level block(s): equippedItem0
- `enemies/xmas-skeleton-blue-helmet-ice.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-blue-ice.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-blue-mage.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-blue-tanker.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-red-mage-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-red-mage.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-red-warrior-elite.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/xmas-skeleton-red-warrior.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-chief.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-elite-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-guard-boss-b.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-guard-boss-c.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-guard-boss.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-knife-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-noob-knife-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `enemies/zombie-rat.character`: Extra top-level block(s): equippedItem0
- `enemies/zombie-red-guard.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter0.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter1.character`: Extra top-level block(s): equippedItem1, equippedItem0
- `fighters/fighter2.character`: Extra top-level block(s): equippedItem1, equippedItem0
- `fighters/fighter3.character`: Extra top-level block(s): equippedItem1, equippedItem0
- `fighters/fighter4.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter5.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter6.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter7.character`: Extra top-level block(s): equippedItem0, equippedItem1
- `fighters/fighter8.character`: Extra top-level block(s): equippedItem0
- `oced-oducebac.character`: Extra top-level block(s): equippedItem0

</details>

### 4. Other Anomalies (3 files)

- **`enemies/blood-mini-warlock.character`**:
  - Line 42: line without '=' inside block 'equippedItem0': "//armor_light_cloth_b.png"
  - Line 43: line without '=' inside block 'equippedItem0': "//armor_fire_cloth_a.png"
  - Line 44: line without '=' inside block 'equippedItem0': "//armor_special_c2.png"
- **`enemies/blood-priest.character`**:
  - Line 42: line without '=' inside block 'equippedItem0': "//armor_light_cloth_b.png"
  - Line 43: line without '=' inside block 'equippedItem0': "//armor_fire_cloth_a.png"
  - Line 44: line without '=' inside block 'equippedItem0': "//armor_special_c2.png"
- **`enemies/my-character.character`**:
  - Line 42: line without '=' inside block 'equippedItem0': "//armor_light_cloth_b.png"
  - Line 43: line without '=' inside block 'equippedItem0': "//armor_fire_cloth_a.png"
  - Line 44: line without '=' inside block 'equippedItem0': "//armor_special_c2.png"

