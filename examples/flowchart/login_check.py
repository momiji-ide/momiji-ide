# Login attempt logic — click "📊 Flowchart" to visualize.
# Shows a while-loop with a decision and a counter.

attempts = 0
logged_in = False

while attempts < 3:
    password = "guess"
    if password == "secret":
        logged_in = True
        print("Welcome!")
    else:
        attempts = attempts + 1
        print("Wrong password")

if logged_in:
    print("Access granted")
else:
    print("Account locked")
