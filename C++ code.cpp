#include <iostream>
#include <vector>
#include <queue>
#include <stack>
#include <limits>
#include <cmath>
#include <set>
#include <map>
#include <algorithm>
#include <chrono>
#include <thread>
using namespace std;

const int INF = numeric_limits<int>::max();

class Node {
public:
    int x, y;
    int cost;
    bool isWall;
    Node* parent;
    
    Node(int x, int y) : x(x), y(y), cost(INF), isWall(false), parent(nullptr) {}
};

class Grid {
public:
    int rows, cols;
    vector<vector<Node*>> grid;
    
    Grid(int r, int c) : rows(r), cols(c) {
        for (int i = 0; i < rows; i++) {
            vector<Node*> row;
            for (int j = 0; j < cols; j++) {
                row.push_back(new Node(i, j));
            }
            grid.push_back(row);
        }
    }
    
    void addWall(int x, int y) {
        if (x >= 0 && x < rows && y >= 0 && y < cols) {
            grid[x][y]->isWall = true;
        }
    }
};

class Pathfinding {
public:
    Grid* grid;
    Node* start;
    Node* target;
    
    Pathfinding(Grid* g, Node* s, Node* t) : grid(g), start(s), target(t) {}
    
    virtual void findPath() = 0;
};

class Dijkstra : public Pathfinding {
public:
    Dijkstra(Grid* g, Node* s, Node* t) : Pathfinding(g, s, t) {}
    
    void findPath() override {
        priority_queue<pair<int, Node*>, vector<pair<int, Node*>>, greater<pair<int, Node*>>> pq;
        start->cost = 0;
        pq.push({0, start});
        
        while (!pq.empty()) {
            Node* curr = pq.top().second;
            pq.pop();
            
            if (curr == target) break;
            
            for (auto [dx, dy] : vector<pair<int, int>>{{0,1}, {1,0}, {0,-1}, {-1,0}}) {
                int nx = curr->x + dx, ny = curr->y + dy;
                if (nx >= 0 && ny >= 0 && nx < grid->rows && ny < grid->cols) {
                    Node* next = grid->grid[nx][ny];
                    if (!next->isWall && curr->cost + 1 < next->cost) {
                        next->cost = curr->cost + 1;
                        next->parent = curr;
                        pq.push({next->cost, next});
                    }
                }
            }
        }
    }
};

class AStar : public Pathfinding {
public:
    AStar(Grid* g, Node* s, Node* t) : Pathfinding(g, s, t) {}
    
    int heuristic(Node* a, Node* b) {
        return abs(a->x - b->x) + abs(a->y - b->y);
    }
    
    void findPath() override {
        priority_queue<pair<int, Node*>, vector<pair<int, Node*>>, greater<pair<int, Node*>>> pq;
        start->cost = 0;
        pq.push({0, start});
        
        while (!pq.empty()) {
            Node* curr = pq.top().second;
            pq.pop();
            
            if (curr == target) break;
            
            for (auto [dx, dy] : vector<pair<int, int>>{{0,1}, {1,0}, {0,-1}, {-1,0}}) {
                int nx = curr->x + dx, ny = curr->y + dy;
                if (nx >= 0 && ny >= 0 && nx < grid->rows && ny < grid->cols) {
                    Node* next = grid->grid[nx][ny];
                    if (!next->isWall && curr->cost + 1 + heuristic(next, target) < next->cost) {
                        next->cost = curr->cost + 1;
                        next->parent = curr;
                        pq.push({next->cost + heuristic(next, target), next});
                    }
                }
            }
        }
    }
};

class BFS : public Pathfinding {
public:
    BFS(Grid* g, Node* s, Node* t) : Pathfinding(g, s, t) {}
    
    void findPath() override {
        queue<Node*> q;
        start->cost = 0;
        q.push(start);
        
        while (!q.empty()) {
            Node* curr = q.front();
            q.pop();
            
            if (curr == target) break;
            
            for (auto [dx, dy] : vector<pair<int, int>>{{0,1}, {1,0}, {0,-1}, {-1,0}}) {
                int nx = curr->x + dx, ny = curr->y + dy;
                if (nx >= 0 && ny >= 0 && nx < grid->rows && ny < grid->cols) {
                    Node* next = grid->grid[nx][ny];
                    if (!next->isWall && next->cost == INF) {
                        next->cost = curr->cost + 1;
                        next->parent = curr;
                        q.push(next);
                    }
                }
            }
        }
    }
};

int main() {
    int rows = 20, cols = 20;
    Grid grid(rows, cols);
    
    Node* start = grid.grid[0][0];
    Node* target = grid.grid[19][19];
    
    grid.addWall(10, 10);
    grid.addWall(10, 11);
    grid.addWall(10, 12);
    
    BFS bfs(&grid, start, target);
    bfs.findPath();
    
    Node* curr = target;
    while (curr) {
        cout << "(" << curr->x << ", " << curr->y << ") <- ";
        curr = curr->parent;
    }
    cout << "Start" << endl;
    
    return 0;
}
