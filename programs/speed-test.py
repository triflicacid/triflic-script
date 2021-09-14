from time import time


def fn():
    start = time()
    s = 0
    for i in range(10000):
        s = s + i
    return s, time() - start


print(fn())
